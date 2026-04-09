"""
Создаёт платёж в ЮKassa. Поддерживает СБП и банковские карты.
Возвращает confirmation_url для редиректа или QR для СБП.
"""
import json
import os
import uuid
import requests


YUKASSA_API = "https://api.yookassa.ru/v3/payments"

PRICES = {
    "consultation": 10000,   # 100 руб (в копейках)
    "document": 50000,        # 500 руб
    "expert": 150000,         # 1500 руб
    "business": 100000,       # 1000 руб
}

DESCRIPTIONS = {
    "consultation": "Юридическая AI-консультация (3 вопроса)",
    "document": "Подготовка юридического документа (исковое, претензия, жалоба)",
    "expert": "Проверка ответа AI экспертом-юристом с заключением",
    "business": "Подготовка договора и юридических документов для бизнеса",
}


def handler(event: dict, context) -> dict:
    cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors, "body": ""}

    body = json.loads(event.get("body") or "{}")
    service_type = body.get("service_type", "consultation")
    payment_method = body.get("payment_method", "bank_card")  # bank_card | sbp
    return_url = body.get("return_url", "https://law-ai-consultation.poehali.dev/")
    user_email = body.get("email", "")

    amount = PRICES.get(service_type, PRICES["consultation"])
    description = DESCRIPTIONS.get(service_type, DESCRIPTIONS["consultation"])

    shop_id = os.environ["YUKASSA_SHOP_ID"]
    secret_key = os.environ["YUKASSA_SECRET_KEY"]

    if payment_method == "sbp":
        payment_method_data = {"type": "sbp"}
    else:
        payment_method_data = {"type": "bank_card"}

    payload = {
        "amount": {"value": f"{amount / 100:.2f}", "currency": "RUB"},
        "confirmation": {"type": "redirect", "return_url": return_url},
        "payment_method_data": payment_method_data,
        "description": description,
        "metadata": {"service_type": service_type, "user_email": user_email},
        "capture": True,
    }

    if user_email:
        payload["receipt"] = {
            "customer": {"email": user_email},
            "items": [{
                "description": description,
                "quantity": "1.00",
                "amount": {"value": f"{amount / 100:.2f}", "currency": "RUB"},
                "vat_code": 1,
                "payment_mode": "full_payment",
                "payment_subject": "service",
            }],
        }

    resp = requests.post(
        YUKASSA_API,
        json=payload,
        auth=(shop_id, secret_key),
        headers={
            "Idempotence-Key": str(uuid.uuid4()),
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    return {
        "statusCode": 200,
        "headers": {**cors, "Content-Type": "application/json"},
        "body": json.dumps({
            "payment_id": data["id"],
            "status": data["status"],
            "confirmation_url": data["confirmation"]["confirmation_url"],
            "amount": amount,
            "service_type": service_type,
        }, ensure_ascii=False),
    }
