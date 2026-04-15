"""
Проверяет статус платежа по inv_id. Live-режим.
Сначала смотрит в БД, если не оплачен — запрашивает ЮКасса API по payment_id.
"""
import json
import os
import requests
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")
YUKASSA_API = "https://api.yookassa.ru/v3/payments"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def check_yukassa_status(shop_id: str, secret_key: str, payment_id: str) -> bool:
    """Запрашивает статус платежа в ЮКасса."""
    resp = requests.get(
        f"{YUKASSA_API}/{payment_id}",
        auth=(shop_id, secret_key),
        timeout=7,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("status") == "succeeded"


def handler(event: dict, context) -> dict:
    """Проверяет статус оплаты по inv_id."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    params = event.get("queryStringParameters") or {}
    inv_id_str = params.get("inv_id", "")

    if not inv_id_str:
        return {
            "statusCode": 400,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": "inv_id required"}),
        }

    try:
        inv_id = int(inv_id_str)
    except ValueError:
        return {
            "statusCode": 400,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": "inv_id must be integer"}),
        }

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT status, service_type, user_id, payment_id FROM {SCHEMA}.orders WHERE inv_id = %s",
            (inv_id,)
        )
        row = cur.fetchone()
    finally:
        cur.close()
        conn.close()

    if not row:
        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"inv_id": inv_id, "paid": False, "status": "not_found"}, ensure_ascii=False),
        }

    db_status, service_type, user_id, payment_id = row

    if db_status == "paid":
        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({
                "inv_id": inv_id,
                "paid": True,
                "status": "paid",
                "service_type": service_type,
                "user_id": user_id,
            }, ensure_ascii=False),
        }

    if not payment_id:
        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"inv_id": inv_id, "paid": False, "status": "pending", "service_type": service_type}, ensure_ascii=False),
        }

    shop_id = os.environ["YUKASSA_SHOP_ID"]
    secret_key = os.environ["YUKASSA_SECRET_KEY"]

    try:
        paid = check_yukassa_status(shop_id, secret_key, payment_id)
    except Exception:
        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"inv_id": inv_id, "paid": False, "status": db_status, "service_type": service_type}, ensure_ascii=False),
        }

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({
            "inv_id": inv_id,
            "paid": paid,
            "status": "paid" if paid else "pending",
            "service_type": service_type,
        }, ensure_ascii=False),
    }