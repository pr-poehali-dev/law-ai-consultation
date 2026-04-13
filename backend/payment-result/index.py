"""
Webhook от ЮКасса (notification URL) после изменения статуса платежа. Live-режим.
ЮКасса шлёт POST с JSON: {type, event, object{id, status, metadata, ...}}.
Проверяем event == 'payment.succeeded', начисляем услугу пользователю.
"""
import json
import os
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

DESCRIPTIONS = {
    "consultation":          "+3 вопроса к AI-юристу",
    "document":              "+1 документ",
    "expert":                "Экспертная проверка юристом",
    "business":              "Бизнес-пакет",
    "subscription_consult":  "Подписка: консультации на 31 день",
    "subscription_docs":     "Подписка: документы на 31 день",
    "plan_starter":          "Тариф Старт: +30 вопросов, +5 документов",
    "plan_pro":              "Тариф Профи: +100 вопросов, +20 документов",
    "plan_max":              "Тариф Максимум: +300 вопросов, +50 документов",
    "business_subscription": "Бизнес-подписка: +150 действий на 31 день",
    "business_actions_10":   "+10 бизнес-действий",
    "business_actions_30":   "+30 бизнес-действий",
    "business_actions_50":   "+50 бизнес-действий",
    "business_actions_60":   "+60 бизнес-действий",
    "business_actions_150":  "+150 бизнес-действий",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def write_billing_log(conn, user_id: int, user_email: str, service_type: str, amount: float, payment_id: str):
    """Записывает событие начисления в billing_log."""
    description = DESCRIPTIONS.get(service_type, service_type)
    cur = conn.cursor()
    try:
        cur.execute(
            f"""INSERT INTO {SCHEMA}.billing_log
                (user_id, user_email, service_type, amount, description, source, payment_id)
                VALUES (%s, %s, %s, %s, %s, 'webhook', %s)""",
            (user_id, user_email, service_type, amount, description, payment_id)
        )
        conn.commit()
    finally:
        cur.close()


def grant_service(conn, user_id: int, service_type: str):
    """Начисляет услугу пользователю по типу."""
    cur = conn.cursor()
    try:
        if service_type == "consultation":
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + 3 WHERE id = %s",
                (user_id,)
            )
        elif service_type == "document":
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_docs = paid_docs + 1 WHERE id = %s",
                (user_id,)
            )
        elif service_type == "expert":
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET paid_expert = TRUE,
                        paid_questions = CASE
                            WHEN paid_questions = 0 AND (subscription_consult_until IS NULL OR subscription_consult_until < NOW()) THEN 3
                            ELSE paid_questions
                        END
                    WHERE id = %s""",
                (user_id,)
            )
        elif service_type == "business":
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_business = paid_business + 1 WHERE id = %s",
                (user_id,)
            )
        elif service_type == "subscription_consult":
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET subscription_consult_until = GREATEST(NOW(), COALESCE(subscription_consult_until, NOW())) + INTERVAL '31 days'
                    WHERE id = %s""",
                (user_id,)
            )
        elif service_type == "subscription_docs":
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET subscription_docs_until = GREATEST(NOW(), COALESCE(subscription_docs_until, NOW())) + INTERVAL '31 days'
                    WHERE id = %s""",
                (user_id,)
            )
        elif service_type == "plan_starter":
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + 30, paid_docs = paid_docs + 5 WHERE id = %s",
                (user_id,)
            )
        elif service_type == "plan_pro":
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + 100, paid_docs = paid_docs + 20 WHERE id = %s",
                (user_id,)
            )
        elif service_type == "plan_max":
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + 300, paid_docs = paid_docs + 50 WHERE id = %s",
                (user_id,)
            )
        elif service_type == "business_subscription":
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET business_subscription_until = GREATEST(NOW(), COALESCE(business_subscription_until, NOW())) + INTERVAL '31 days',
                        business_actions_left = business_actions_left + 150
                    WHERE id = %s""",
                (user_id,)
            )
        elif service_type == "business_actions_10":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left + 10 WHERE id = %s", (user_id,))
        elif service_type == "business_actions_30":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left + 30 WHERE id = %s", (user_id,))
        elif service_type == "business_actions_50":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left + 50 WHERE id = %s", (user_id,))
        elif service_type == "business_actions_60":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left + 60 WHERE id = %s", (user_id,))
        elif service_type == "business_actions_150":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left + 150 WHERE id = %s", (user_id,))
        conn.commit()
    finally:
        cur.close()


def handler(event: dict, context) -> dict:
    """Webhook ЮКасса — обрабатывает событие payment.succeeded."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    raw_body = event.get("body") or ""
    print(f"WEBHOOK RAW BODY: {raw_body[:500]}")
    print(f"WEBHOOK METHOD: {event.get('httpMethod')} HEADERS: {dict(list((event.get('headers') or {}).items())[:5])}")

    try:
        notification = json.loads(raw_body)
    except Exception as e:
        print(f"WEBHOOK JSON PARSE ERROR: {e}, body={raw_body[:200]}")
        return {"statusCode": 400, "headers": CORS, "body": "Bad JSON"}

    event_type = notification.get("event", "")
    print(f"WEBHOOK EVENT TYPE: {event_type}")

    if event_type != "payment.succeeded":
        print(f"WEBHOOK IGNORED: event={event_type}")
        return {"statusCode": 200, "headers": CORS, "body": "ok"}

    payment_obj = notification.get("object", {})
    payment_id = payment_obj.get("id", "")
    status = payment_obj.get("status", "")
    metadata = payment_obj.get("metadata", {})
    amount_obj = payment_obj.get("amount", {})
    amount_val = float(amount_obj.get("value", 0)) if amount_obj else 0

    print(f"WEBHOOK PAYMENT: id={payment_id} status={status} metadata={metadata}")

    if status != "succeeded" or not payment_id:
        print(f"WEBHOOK SKIP: status={status} payment_id={payment_id}")
        return {"statusCode": 200, "headers": CORS, "body": "ok"}

    inv_id_str = metadata.get("inv_id", "")
    service_type = metadata.get("service_type", "")
    user_id_str = metadata.get("user_id", "")

    try:
        inv_id = int(inv_id_str)
    except (ValueError, TypeError):
        return {"statusCode": 400, "headers": CORS, "body": "bad inv_id"}

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT id, user_id, user_email, service_type, amount, status FROM {SCHEMA}.orders WHERE inv_id = %s",
            (inv_id,)
        )
        row = cur.fetchone()
        if not row:
            return {"statusCode": 404, "headers": CORS, "body": f"Order not found: {inv_id}"}

        order_id, db_user_id, db_user_email, db_service_type, db_amount, db_status = row

        if db_status == "paid":
            return {"statusCode": 200, "headers": CORS, "body": "ok"}

        cur.execute(
            f"UPDATE {SCHEMA}.orders SET status = 'paid', paid_at = NOW(), payment_id = %s WHERE id = %s",
            (payment_id, order_id)
        )
        conn.commit()

        effective_user_id = db_user_id
        if not effective_user_id and user_id_str:
            try:
                effective_user_id = int(user_id_str)
            except (ValueError, TypeError):
                pass

        effective_service = db_service_type or service_type
        effective_amount = float(db_amount) if db_amount else amount_val
        effective_email = db_user_email or ""

        print(f"WEBHOOK GRANT: user_id={effective_user_id} service={effective_service} amount={effective_amount}")
        if effective_user_id and effective_service:
            grant_service(conn, effective_user_id, effective_service)
            write_billing_log(conn, effective_user_id, effective_email, effective_service, effective_amount, payment_id)
            print(f"WEBHOOK DONE: granted {effective_service} to user {effective_user_id}")
        else:
            print(f"WEBHOOK SKIP GRANT: user_id={effective_user_id} service={effective_service}")

    finally:
        cur.close()
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": "ok"}