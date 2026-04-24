"""
Создаёт платёж в ЮКасса и возвращает ссылку на оплату. Live-режим.
Использует API ЮКасса v3: POST /v3/payments с Basic Auth (shop_id:secret_key).
Фискализация по 54-ФЗ встроена в ЮКасса через receipt.
"""
import json
import os
import uuid
import requests
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")
YUKASSA_API = "https://api.yookassa.ru/v3/payments"
YUKASSA_AGENT_ID = "515407"

PRICES = {
    "consultation":         "990.00",
    "document":             "600.00",
    "expert":               "990.00",
    "business":             "1000.00",
    "subscription_consult": "1990.00",
    "subscription_docs":    "4990.00",
    # Тарифы
    "plan_starter":          "990.00",
    "plan_starter_discount": "495.00",
    "plan_pro":              "3990.00",
    "plan_max":              "5990.00",
    # Бизнес-подписка
    "business_subscription": "4990.00",
    "business_actions_10":   "1000.00",
    "business_actions_30":   "3000.00",
    "business_actions_60":   "6000.00",
    "business_actions_50":   "3500.00",
    "business_actions_150":  "9000.00",
}

DESCRIPTIONS = {
    "consultation":         "Консультация живого юриста",
    "document":             "Подготовка юридического документа",
    "expert":               "Консультация живого юриста · разбор ситуации",
    "business":             "Бизнес-пакет (договор + документы)",
    "subscription_consult": "Подписка: безлимитные консультации (1 мес.)",
    "subscription_docs":    "Подписка: безлимитные документы (1 мес.)",
    "plan_starter":          "Пакет Старт: 30 вопросов AI + 5 документов",
    "plan_starter_discount": "Пакет Старт (акция): 30 вопросов AI + 5 документов",
    "plan_pro":              "Тариф Профи: 100 вопросов + 20 документов (1 мес.)",
    "plan_max":              "Тариф Максимум: 300 вопросов + 50 документов (1 мес.)",
    "business_subscription": "Бизнес-тариф: 150 действий/мес · PDF/DOC анализ · .doc выгрузка",
    "business_actions_10":   "Бизнес: +10 дополнительных действий",
    "business_actions_30":   "Бизнес: +30 дополнительных действий",
    "business_actions_60":   "Бизнес: +60 дополнительных действий",
    "business_actions_50":   "Бизнес: +50 дополнительных действий",
    "business_actions_150":  "Бизнес: +150 дополнительных действий",
}

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def handler(event: dict, context) -> dict:
    """Создаёт платёж ЮКасса и возвращает ссылку для редиректа."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    try:
        return _handle(event, context)
    except Exception as e:
        import traceback
        print("PAYMENT-CREATE ERROR:", traceback.format_exc())
        return {
            "statusCode": 500,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)}, ensure_ascii=False),
        }


def _handle(event: dict, context) -> dict:

    body = json.loads(event.get("body") or "{}")
    service_type = body.get("service_type", "consultation")
    user_email = (body.get("email") or "").strip().lower()
    user_id = body.get("user_id")
    return_url = body.get("return_url", "https://ии-право.рф/cabinet?payment=success")

    if service_type not in PRICES:
        return {
            "statusCode": 400,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": f"Неизвестный тип услуги: {service_type}"}, ensure_ascii=False),
        }

    shop_id = os.environ["YUKASSA_SHOP_ID"]
    secret_key = os.environ["YUKASSA_SECRET_KEY"]
    amount = PRICES[service_type]
    description = DESCRIPTIONS[service_type]

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""INSERT INTO {SCHEMA}.orders (inv_id, user_id, user_email, service_type, amount, status)
                VALUES (nextval('{SCHEMA}.orders_id_seq'), %s, %s, %s, %s, 'pending')
                RETURNING id""",
            (user_id, user_email, service_type, amount)
        )
        inv_id = cur.fetchone()[0]
        cur.execute(
            f"UPDATE {SCHEMA}.orders SET inv_id = %s WHERE id = %s",
            (inv_id, inv_id)
        )
        conn.commit()
    finally:
        cur.close()

    idempotency_key = str(uuid.uuid4())

    payment_data = {
        "amount": {"value": amount, "currency": "RUB"},
        "confirmation": {
            "type": "redirect",
            "return_url": f"{return_url}&inv_id={inv_id}",
        },
        "capture": True,
        "description": description,
        "metadata": {
            "inv_id": str(inv_id),
            "service_type": service_type,
            "user_id": str(user_id) if user_id else "",
        },
    }

    if user_email:
        payment_data["receipt"] = {
            "customer": {"email": user_email},
            "items": [{
                "description": description[:128],
                "quantity": "1.00",
                "amount": {"value": amount, "currency": "RUB"},
                "vat_code": 1,
                "payment_mode": "full_payment",
                "payment_subject": "service",
            }],
        }

    resp = requests.post(
        YUKASSA_API,
        auth=(shop_id, secret_key),
        headers={
            "Content-Type": "application/json",
            "Idempotence-Key": idempotency_key,
        },
        json=payment_data,
        timeout=15,
    )

    if not resp.ok:
        print(f"YUKASSA ERROR {resp.status_code}: {resp.text[:500]}")
        return {
            "statusCode": 502,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": f"ЮКасса: {resp.status_code} {resp.text[:300]}"}, ensure_ascii=False),
        }

    payment = resp.json()
    pay_url = payment["confirmation"]["confirmation_url"]
    payment_id = payment["id"]

    cur2 = conn.cursor()
    try:
        cur2.execute(
            f"UPDATE {SCHEMA}.orders SET payment_id = %s WHERE id = %s",
            (payment_id, inv_id)
        )
        conn.commit()
    except Exception:
        pass
    finally:
        cur2.close()
        conn.close()

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({
            "inv_id": inv_id,
            "payment_id": payment_id,
            "pay_url": pay_url,
            "amount": amount,
            "service_type": service_type,
        }, ensure_ascii=False),
    }