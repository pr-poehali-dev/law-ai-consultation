"""
Единый API: AI-юрист (GigaChat/YandexGPT) + авторизация (email+пароль).
mode: "chat" | "document" | "clarify"
auth actions: register, login, me, logout, update-profile, consume-question, add-paid-service
"""
import json
import os
import uuid
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
    "Ты — профессиональный юрист-составитель документов по законодательству РФ. "
    "Составляй документы по установленным формам: реквизиты, шапка, основная часть, дата, подписи. "
    "Используй все предоставленные реквизиты сторон в полном объёме. "
    "Ответ до 600 слов. "
    "В конце: 'Документ подготовлен AI. Рекомендуется проверка у практикующего юриста.'"
)

SYSTEM_CLARIFY = (
    "Ты — опытный юрист, помогающий собрать реквизиты и данные для составления юридического документа. "
    "Задавай уточняющие вопросы по одному за раз — чётко и конкретно. "
    "Когда все необходимые данные собраны, ответь строго в формате JSON: "
    '{\"ready\": true, \"summary\": \"краткое изложение всех собранных данных в одном абзаце\"}. '
    "Не составляй сам документ на этапе сбора данных. "
    "Для каждого типа документа обязательно собери: "
    "ФИО и адрес заявителя/истца, ФИО/название и адрес ответчика/другой стороны, "
    "суть спора или предмет договора, суммы и даты, иные существенные обстоятельства."
)

DOC_PROMPTS = {
    "claim": "Составь исковое заявление в районный суд используя все предоставленные данные: {details}",
    "complaint": "Составь жалобу в Роспотребнадзор используя все предоставленные данные: {details}",
    "pretension": "Составь досудебную претензию используя все предоставленные данные: {details}",
    "contract": "Составь договор ГПХ используя все предоставленные данные: {details}",
    "business_contract": "Составь договор для бизнеса используя все предоставленные данные: {details}",
}

CLARIFY_STARTERS = {
    "claim": "Помогу составить исковое заявление. Для начала — кто является истцом? Укажите ФИО и адрес проживания.",
    "complaint": "Помогу составить жалобу в Роспотребнадзор. Для начала — укажите ваши ФИО и адрес регистрации.",
    "pretension": "Помогу составить досудебную претензию. Для начала — укажите ваши ФИО и адрес, а также кому направляется претензия.",
    "contract": "Помогу составить договор ГПХ. Для начала — укажите данные Заказчика: ФИО (или название организации) и адрес.",
    "business_contract": "Помогу составить договор для бизнеса. Для начала — укажите данные первой стороны: название организации, ИНН, адрес и ФИО руководителя.",
}

YANDEX_MODEL = "gpt://b1gd8kncmd8nf4j7h770/yandexgpt-5.1/latest"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}


def get_gigachat_token() -> str:
    auth_key = os.environ["GIGACHAT_AUTH_KEY"].strip()
    resp = requests.post(
        "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
        headers={
            "Authorization": f"Basic {auth_key}",
            "RqUID": str(uuid.uuid4()),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"scope": "GIGACHAT_API_PERS"},
        verify=False,
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def call_gigachat(system_prompt: str, messages: list, max_tokens: int = 512) -> str:
    token = get_gigachat_token()
    resp = requests.post(
        "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={
            "model": "GigaChat",
            "messages": [{"role": "system", "content": system_prompt}] + messages,
            "temperature": 0.7,
            "max_tokens": max_tokens,
        },
        verify=False,
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


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
                "temperature": 0.7,
                "maxTokens": max_tokens,
            },
            "messages": yandex_messages,
        },
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()["result"]["alternatives"][0]["message"]["text"]


def handler(event: dict, context) -> dict:
    """Единый API: AI-юрист + авторизация (OTP по email)."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "POST")
    headers = event.get("headers") or {}
    token = headers.get("X-Auth-Token") or headers.get("x-auth-token", "")

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    # --- Auth actions via body.action ---
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

    # --- AI chat / document ---
    try:
        mode = body.get("mode", "chat")
        engine = body.get("engine", "yandex")

        if mode == "clarify_start":
            doc_type = body.get("doc_type", "claim")
            starter = CLARIFY_STARTERS.get(doc_type, CLARIFY_STARTERS["claim"])
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"answer": starter, "ready": False}, ensure_ascii=False),
            }

        elif mode == "clarify":
            doc_type = body.get("doc_type", "claim")
            messages = body.get("messages", [])
            if not messages:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "messages required"})}
            system = SYSTEM_CLARIFY
            user_messages = messages
            max_tokens = 400
            if engine == "yandex":
                answer = call_yandex(system, user_messages, max_tokens)
            else:
                answer = call_gigachat(system, user_messages, max_tokens)
            ready = False
            summary = None
            try:
                start = answer.find("{")
                end = answer.rfind("}") + 1
                if start != -1 and end > start:
                    parsed = json.loads(answer[start:end])
                    if parsed.get("ready"):
                        ready = True
                        summary = parsed.get("summary", "")
            except Exception:
                pass
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"answer": answer if not ready else summary, "ready": ready, "summary": summary}, ensure_ascii=False),
            }

        elif mode == "document":
            doc_type = body.get("doc_type", "claim")
            details = body.get("details", "")
            if not details:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "details required"})}
            prompt = DOC_PROMPTS.get(doc_type, DOC_PROMPTS["claim"]).format(details=details)
            user_messages = [{"role": "user", "content": prompt}]
            system = SYSTEM_DOCUMENT
            max_tokens = 1000
        else:
            user_messages = body.get("messages", [])
            if not user_messages:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "messages required"})}
            system = SYSTEM_CHAT
            max_tokens = 512

        if engine == "yandex":
            answer = call_yandex(system, user_messages, max_tokens)
        else:
            answer = call_gigachat(system, user_messages, max_tokens)

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