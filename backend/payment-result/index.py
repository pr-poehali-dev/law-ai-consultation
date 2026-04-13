"""
Webhook от ЮКасса (notification URL) после изменения статуса платежа.
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


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


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
        conn.commit()
    finally:
        cur.close()


def handler(event: dict, context) -> dict:
    """Webhook ЮКасса — обрабатывает событие payment.succeeded."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    raw_body = event.get("body") or ""
    try:
        notification = json.loads(raw_body)
    except Exception:
        return {"statusCode": 400, "headers": CORS, "body": "Bad JSON"}

    event_type = notification.get("event", "")
    if event_type != "payment.succeeded":
        return {"statusCode": 200, "headers": CORS, "body": "ok"}

    payment_obj = notification.get("object", {})
    payment_id = payment_obj.get("id", "")
    status = payment_obj.get("status", "")
    metadata = payment_obj.get("metadata", {})

    if status != "succeeded" or not payment_id:
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
            f"SELECT id, user_id, service_type, status FROM {SCHEMA}.orders WHERE inv_id = %s",
            (inv_id,)
        )
        row = cur.fetchone()
        if not row:
            return {"statusCode": 404, "headers": CORS, "body": f"Order not found: {inv_id}"}

        order_id, db_user_id, db_service_type, db_status = row

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

        if effective_user_id and effective_service:
            grant_service(conn, effective_user_id, effective_service)

    finally:
        cur.close()
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": "ok"}
