"""
Прокси для GigaChat API — получает токен и отправляет сообщения юридического чата.
"""
import json
import os
import uuid
import requests


SYSTEM_PROMPT = (
    "Ты — AI-юрист, обученный на реальной судебной практике Российской Федерации. "
    "Отвечай строго по законодательству РФ: ГК, ТК, ЖК, ЗоЗПП, УК, КоАП и другим актуальным нормам. "
    "Давай чёткие, структурированные ответы с ссылками на конкретные статьи законов. "
    "В конце каждого ответа добавляй короткий дисклеймер: "
    "'Ответ подготовлен AI на основе базы знаний юристов и не заменяет индивидуальную консультацию специалиста.'"
)


def get_token(auth_key: str) -> str:
    resp = requests.post(
        "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
        headers={
            "Authorization": f"Basic {auth_key}",
            "RqUID": str(uuid.uuid4()),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"scope": "GIGACHAT_API_PERS"},
        verify=False,
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def handler(event: dict, context) -> dict:
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
        messages = body.get("messages", [])
        if not messages:
            return {
                "statusCode": 400,
                "headers": cors_headers,
                "body": json.dumps({"error": "messages required"}),
            }

        auth_key = os.environ["GIGACHAT_AUTH_KEY"]
        token = get_token(auth_key)

        payload = {
            "model": "GigaChat",
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
            "temperature": 0.7,
            "max_tokens": 1024,
        }

        resp = requests.post(
            "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=payload,
            verify=False,
            timeout=30,
        )
        resp.raise_for_status()
        answer = resp.json()["choices"][0]["message"]["content"]

        return {
            "statusCode": 200,
            "headers": {**cors_headers, "Content-Type": "application/json"},
            "body": json.dumps({"answer": answer}, ensure_ascii=False),
        }

    except requests.HTTPError as e:
        return {
            "statusCode": 502,
            "headers": cors_headers,
            "body": json.dumps({"error": f"GigaChat error: {e.response.status_code}"}),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps({"error": str(e)}),
        }
