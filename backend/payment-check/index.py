"""
Проверяет статус платежа в ЮKassa по payment_id.
Возвращает статус: pending | waiting_for_capture | succeeded | canceled
"""
import json
import os
import requests


def handler(event: dict, context) -> dict:
    cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors, "body": ""}

    params = event.get("queryStringParameters") or {}
    payment_id = params.get("payment_id", "")

    if not payment_id:
        return {
            "statusCode": 400,
            "headers": cors,
            "body": json.dumps({"error": "payment_id required"}),
        }

    shop_id = os.environ["YUKASSA_SHOP_ID"]
    secret_key = os.environ["YUKASSA_SECRET_KEY"]

    resp = requests.get(
        f"https://api.yookassa.ru/v3/payments/{payment_id}",
        auth=(shop_id, secret_key),
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    return {
        "statusCode": 200,
        "headers": {**cors, "Content-Type": "application/json"},
        "body": json.dumps({
            "payment_id": data["id"],
            "status": data["status"],
            "paid": data.get("paid", False),
            "service_type": data.get("metadata", {}).get("service_type", ""),
            "amount": data["amount"]["value"],
        }, ensure_ascii=False),
    }
