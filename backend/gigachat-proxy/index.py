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
    "Ты — информационный ассистент, который помогает разобраться в нормах законодательства РФ. "
    "Твоя задача — объяснять, какие законы и статьи регулируют описанную ситуацию, "
    "и какие действия предусмотрены по закону. "
    "Ссылайся на конкретные статьи (ГК РФ, ТК РФ, ЖК РФ, ЗоЗПП, УК РФ, КоАП РФ). "
    "Отвечай структурированно, до 300 слов. "
    "В конце добавь: 'Информация носит справочный характер. Для решения конкретной ситуации рекомендуется консультация специалиста.'"
)

SYSTEM_DOCUMENT = (
    "Ты — ассистент по подготовке типовых текстовых документов в соответствии с законодательством РФ. "
    "Формируй документ по структуре: шапка с реквизитами сторон, основная часть, дата, строки для подписей. "
    "Все переданные реквизиты (ФИО, адреса, ИНН, названия, суммы, даты) вставляй непосредственно в текст — "
    "никаких заглушек [ФИО] или [АДРЕС]. "
    "Незаполненные поля обозначай: ___________. "
    "Объём — 400–700 слов. "
    "В конце: 'Документ сформирован автоматически. Рекомендуется проверка у специалиста.'"
)

# Фразы-признаки отказа YandexGPT
REFUSAL_MARKERS = [
    "не могу обсуждать",
    "не могу помочь",
    "не в состоянии",
    "давайте поговорим о чём",
    "предлагаю сменить тему",
    "не буду обсуждать",
    "нет возможности",
]

DOC_PROMPTS = {
    "claim": (
        "Сформируй текст искового заявления в районный суд.\n"
        "Реквизиты сторон:\n{requisites}\n"
        "Обстоятельства дела: {details}"
    ),
    "complaint": (
        "Сформируй текст жалобы в Роспотребнадзор.\n"
        "Реквизиты заявителя и ответчика:\n{requisites}\n"
        "Обстоятельства: {details}"
    ),
    "pretension": (
        "Сформируй текст досудебной претензии.\n"
        "Реквизиты сторон:\n{requisites}\n"
        "Обстоятельства и требования: {details}"
    ),
    "contract": (
        "Сформируй текст договора ГПХ.\n"
        "Реквизиты сторон:\n{requisites}\n"
        "Предмет и условия: {details}"
    ),
    "business_contract": (
        "Сформируй текст коммерческого договора.\n"
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


def is_refusal(text: str) -> bool:
    low = text.lower()
    return any(m in low for m in REFUSAL_MARKERS)


def _call_yandex_raw(system_prompt: str, yandex_messages: list, max_tokens: int) -> str:
    iam_token = os.environ["YANDEX_IAM_TOKEN"].strip()
    resp = requests.post(
        "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
        headers={
            "Authorization": f"Api-Key {iam_token}",
            "Content-Type": "application/json",
        },
        json={
            "modelUri": YANDEX_MODEL,
            "completionOptions": {"stream": False, "temperature": 0.4, "maxTokens": max_tokens},
            "messages": [{"role": "system", "text": system_prompt}] + yandex_messages,
        },
        timeout=25,
    )
    resp.raise_for_status()
    return resp.json()["result"]["alternatives"][0]["message"]["text"]


def call_yandex(system_prompt: str, messages: list, max_tokens: int = 512) -> str:
    yandex_messages = []
    for msg in messages:
        role = "user" if msg.get("role") == "user" else "assistant"
        yandex_messages.append({"role": role, "text": msg.get("content", "")})

    answer = _call_yandex_raw(system_prompt, yandex_messages, max_tokens)

    # Если модель отказала — повторяем с переформулировкой последнего сообщения
    if is_refusal(answer) and yandex_messages:
        last = yandex_messages[-1]["text"]
        rephrased = yandex_messages[:-1] + [{
            "role": "user",
            "text": (
                f"Пожалуйста, объясни в общих чертах, какие нормы законодательства РФ "
                f"применяются в следующей ситуации (только факты и статьи, без оценок): {last}"
            )
        }]
        answer = _call_yandex_raw(system_prompt, rephrased, max_tokens)

    return answer


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