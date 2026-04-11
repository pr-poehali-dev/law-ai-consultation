"""
Единый API: AI-юрист (YandexGPT) + авторизация.
mode: "chat" | "document"
auth actions: register, login, me, logout, update-profile, consume-question, add-paid-service
"""
import json
import os
import warnings
import requests

from auth_handler import (
    handle_register, handle_login, handle_me,
    handle_logout, handle_update_profile,
    handle_consume_question, handle_add_paid_service,
)

warnings.filterwarnings("ignore")

SYSTEM_CHAT = (
    "Ты — профессиональный AI-юрист, специализирующийся на законодательстве Российской Федерации. "
    "Отвечай чётко и структурированно, ссылайся на конкретные статьи законов (ГК РФ, ТК РФ, ЖК РФ, ЗоЗПП, УК РФ, КоАП РФ). "
    "Давай практические рекомендации. Ответ до 300 слов. "
    "В конце: 'Ответ подготовлен AI на основе базы знаний юристов. Не заменяет консультацию специалиста.'"
)

SYSTEM_DOCUMENT = (
    "Ты — профессиональный юрист-составитель документов по законодательству Российской Федерации. "
    "Составляй юридические документы строго по установленным формам: "
    "шапка с реквизитами сторон, основная часть со ссылками на нормы закона, дата, место для подписей. "
    "ОБЯЗАТЕЛЬНО используй все переданные реквизиты сторон (ФИО, адреса, ИНН, названия организаций и т.д.) — "
    "вставляй их непосредственно в текст документа, не заменяй заглушками вроде [ФИО] или [АДРЕС]. "
    "Если реквизит не указан — оставь пустое поле для заполнения: ___________. "
    "Объём документа — 400–700 слов. "
    "В конце: 'Документ подготовлен AI-юристом. Рекомендуется проверка у практикующего юриста.'"
)

DOC_PROMPTS = {
    "claim": (
        "Составь исковое заявление в районный суд.\n"
        "Реквизиты сторон:\n{requisites}\n"
        "Обстоятельства дела: {details}"
    ),
    "complaint": (
        "Составь жалобу в Роспотребнадзор.\n"
        "Реквизиты заявителя и ответчика:\n{requisites}\n"
        "Обстоятельства: {details}"
    ),
    "pretension": (
        "Составь досудебную претензию.\n"
        "Реквизиты сторон:\n{requisites}\n"
        "Обстоятельства и требования: {details}"
    ),
    "contract": (
        "Составь договор гражданско-правового характера (ГПХ).\n"
        "Реквизиты сторон:\n{requisites}\n"
        "Предмет и условия договора: {details}"
    ),
    "business_contract": (
        "Составь коммерческий договор.\n"
        "Реквизиты сторон:\n{requisites}\n"
        "Предмет и условия сделки: {details}"
    ),
}

YANDEX_MODEL = "gpt://b1gd8kncmd8nf4j7h770/yandexgpt-5.1/latest"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}


def call_yandex(system_prompt: str, messages: list, max_tokens: int = 512) -> str:
    iam_token = os.environ["YANDEX_IAM_TOKEN"].strip()
    yandex_messages = [{"role": "system", "text": system_prompt}]
    for msg in messages:
        role = "user" if msg.get("role") == "user" else "assistant"
        yandex_messages.append({"role": role, "text": msg.get("content", "")})
    resp = requests.post(
        "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
        headers={
            "Authorization": f"Api-Key {iam_token}",
            "Content-Type": "application/json",
        },
        json={
            "modelUri": YANDEX_MODEL,
            "completionOptions": {
                "stream": False,
                "temperature": 0.5,
                "maxTokens": max_tokens,
            },
            "messages": yandex_messages,
        },
        timeout=25,
    )
    resp.raise_for_status()
    return resp.json()["result"]["alternatives"][0]["message"]["text"]


def handler(event: dict, context) -> dict:
    """Единый API: AI-юрист (YandexGPT) + авторизация."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    headers = event.get("headers") or {}
    token = headers.get("X-Auth-Token") or headers.get("x-auth-token", "")

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    # --- Auth ---
    action = body.get("action", "")
    auth_actions = {
        "register": lambda: handle_register(body),
        "login": lambda: handle_login(body),
        "me": lambda: handle_me(token),
        "logout": lambda: handle_logout(token),
        "update-profile": lambda: handle_update_profile(token, body),
        "consume-question": lambda: handle_consume_question(token),
        "add-paid-service": lambda: handle_add_paid_service(token, body),
    }

    if action in auth_actions:
        result = auth_actions[action]()
        status = result.get("status", 200)
        if "error" in result:
            return {
                "statusCode": status,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"error": result["error"]}, ensure_ascii=False),
            }
        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(result.get("data", {}), ensure_ascii=False),
        }

    # --- AI ---
    try:
        mode = body.get("mode", "chat")

        if mode == "document":
            doc_type = body.get("doc_type", "claim")
            details = body.get("details", "").strip()
            requisites = body.get("requisites", "").strip()
            if not details:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "details required"})}
            req_block = requisites if requisites else "не указаны"
            prompt = DOC_PROMPTS.get(doc_type, DOC_PROMPTS["claim"]).format(
                requisites=req_block, details=details
            )
            answer = call_yandex(SYSTEM_DOCUMENT, [{"role": "user", "content": prompt}], max_tokens=1200)

        else:
            user_messages = body.get("messages", [])
            if not user_messages:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "messages required"})}
            answer = call_yandex(SYSTEM_CHAT, user_messages, max_tokens=512)

        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"answer": answer}, ensure_ascii=False),
        }

    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 0
        try:
            detail = e.response.json()
        except Exception:
            detail = e.response.text[:300] if e.response else ""
        return {
            "statusCode": 502,
            "headers": CORS,
            "body": json.dumps({"error": f"HTTP {code}: {detail}"}, ensure_ascii=False),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": CORS,
            "body": json.dumps({"error": str(e)}),
        }
