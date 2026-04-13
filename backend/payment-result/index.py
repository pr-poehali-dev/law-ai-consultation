"""
ResultURL — webhook от Robokassa после успешной оплаты.
Robokassa шлёт POST: OutSum, InvId, SignatureValue, shp_* ...
Проверяем подпись MD5(OutSum:InvId:Password2[:shp_params]), начисляем услугу, отвечаем OK{InvId}.
"""
import json
import os
import hashlib
import urllib.parse
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def verify_signature(out_sum: str, inv_id: str, crc: str, password2: str) -> bool:
    """Проверяет подпись от Robokassa: MD5(OutSum:InvId:Password2)"""
    raw = f"{out_sum}:{inv_id}:{password2}"
    expected = hashlib.md5(raw.encode("utf-8")).hexdigest().upper()
    return expected == crc.upper()


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
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    # Robokassa может слать и POST (form-data) и GET
    raw_body = event.get("body") or ""
    params = {}

    # Парсим тело как form-urlencoded (POST)
    if raw_body:
        try:
            parsed = urllib.parse.parse_qs(raw_body, keep_blank_values=True)
            params = {k: v[0] for k, v in parsed.items()}
        except Exception:
            pass

    # Если ничего не пришло в body — пробуем query string (GET)
    if not params:
        params = event.get("queryStringParameters") or {}

    out_sum = params.get("OutSum", "")
    inv_id = params.get("InvId", "")
    crc = params.get("SignatureValue", "")

    if not out_sum or not inv_id or not crc:
        return {
            "statusCode": 400,
            "headers": {**CORS, "Content-Type": "text/plain"},
            "body": "Bad request: missing params",
        }

    password2 = os.environ["ROBOKASSA_PASS2"]

    if not verify_signature(out_sum, inv_id, crc, password2):
        return {
            "statusCode": 400,
            "headers": {**CORS, "Content-Type": "text/plain"},
            "body": "bad sign",
        }

    inv_id_int = int(inv_id)

    conn = get_conn()
    cur = conn.cursor()
    try:
        # Получаем заказ
        cur.execute(
            f"SELECT id, user_id, service_type, status FROM {SCHEMA}.orders WHERE inv_id = %s",
            (inv_id_int,)
        )
        row = cur.fetchone()
        if not row:
            return {
                "statusCode": 404,
                "headers": {**CORS, "Content-Type": "text/plain"},
                "body": f"Order not found: {inv_id}",
            }

        order_id, user_id, service_type, status = row

        # Защита от двойного начисления
        if status == "paid":
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "text/plain"},
                "body": f"OK{inv_id}",
            }

        # Помечаем заказ оплаченным
        cur.execute(
            f"UPDATE {SCHEMA}.orders SET status = 'paid', paid_at = NOW() WHERE id = %s",
            (order_id,)
        )
        conn.commit()

        # Начисляем услугу пользователю (если user_id привязан)
        if user_id:
            grant_service(conn, user_id, service_type)

    finally:
        cur.close()
        conn.close()

    # Robokassa ожидает ровно такой ответ: OK{InvId}
    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "text/plain"},
        "body": f"OK{inv_id}",
    }