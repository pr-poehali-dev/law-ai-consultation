"""
Создаёт заказ в БД и возвращает ссылку на оплату через Robokassa.
Подпись: MD5(MrchLogin:OutSum:InvId:Receipt:Password1)
Receipt передаётся как URL-encoded JSON для фискализации по 54-ФЗ.
"""
import json
import os
import hashlib
import urllib.parse
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")
ROBOKASSA_URL = "https://auth.robokassa.ru/Merchant/Index.aspx"

PRICES = {
    "consultation": "100.00",
    "document":     "500.00",
    "expert":       "1500.00",
    "business":     "1000.00",
    "subscription_consult": "1990.00",
    "subscription_docs":    "4990.00",
}

DESCRIPTIONS = {
    "consultation": "AI-консультация (3 вопроса)",
    "document":     "Подготовка юридического документа",
    "expert":       "Экспертная проверка юристом",
    "business":     "Бизнес-пакет (договор + документы)",
    "subscription_consult": "Подписка: безлимитные консультации (1 мес.)",
    "subscription_docs":    "Подписка: безлимитные документы (1 мес.)",
}

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def build_receipt(description: str, amount: str, email: str) -> str:
    """Формирует JSON чека для фискализации (54-ФЗ). tax=none — для ИП на УСН."""
    receipt = {
        "sno": "usn_income",
        "items": [{
            "name": description[:128],
            "quantity": 1,
            "sum": float(amount),
            "payment_method": "full_payment",
            "payment_object": "service",
            "tax": "none",
        }]
    }
    if email:
        receipt["email"] = email
    return json.dumps(receipt, ensure_ascii=False)


def make_signature(login: str, out_sum: str, inv_id: int, receipt_encoded: str, password1: str) -> str:
    """MD5(MrchLogin:OutSum:InvId:Receipt:Password1)"""
    raw = f"{login}:{out_sum}:{inv_id}:{receipt_encoded}:{password1}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest().upper()


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    body = json.loads(event.get("body") or "{}")
    service_type = body.get("service_type", "consultation")
    user_email = (body.get("email") or "").strip()
    user_id = body.get("user_id")  # опционально — если пользователь авторизован

    if service_type not in PRICES:
        return {
            "statusCode": 400,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": f"Неизвестный тип услуги: {service_type}"}, ensure_ascii=False),
        }

    login = os.environ["ROBOKASSA_LOGIN"]
    password1 = os.environ["ROBOKASSA_PASS1"]
    is_test = os.environ.get("ROBOKASSA_TEST", "0")

    out_sum = PRICES[service_type]
    description = DESCRIPTIONS[service_type]

    conn = get_conn()
    cur = conn.cursor()
    try:
        # Создаём заказ в БД, получаем InvId (= id записи)
        cur.execute(
            f"""INSERT INTO {SCHEMA}.orders (inv_id, user_id, user_email, service_type, amount, status)
                VALUES (nextval('{SCHEMA}.orders_id_seq'), %s, %s, %s, %s, 'pending')
                RETURNING id""",
            (user_id, user_email, service_type, out_sum)
        )
        inv_id = cur.fetchone()[0]
        # inv_id = id = InvId
        cur.execute(
            f"UPDATE {SCHEMA}.orders SET inv_id = %s WHERE id = %s",
            (inv_id, inv_id)
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()

    receipt_json = build_receipt(description, out_sum, user_email)
    receipt_encoded = urllib.parse.quote(receipt_json)

    signature = make_signature(login, out_sum, inv_id, receipt_encoded, password1)

    params = {
        "MrchLogin": login,
        "OutSum": out_sum,
        "InvId": str(inv_id),
        "Description": description,
        "SignatureValue": signature,
        "Receipt": receipt_encoded,
        "Encoding": "utf-8",
        "Culture": "ru",
    }
    if user_email:
        params["Email"] = user_email
    if is_test == "1":
        params["IsTest"] = "1"

    pay_url = ROBOKASSA_URL + "?" + "&".join(f"{k}={urllib.parse.quote(str(v), safe='')}" for k, v in params.items())

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({
            "inv_id": inv_id,
            "pay_url": pay_url,
            "amount": out_sum,
            "service_type": service_type,
        }, ensure_ascii=False),
    }
