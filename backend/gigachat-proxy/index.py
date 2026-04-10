"""
AI-юрист на базе GigaChat (Сбер) и YandexGPT. v4
mode: "chat" (консультация) | "document" (генерация документа)
engine: "gigachat" (по умолчанию) | "yandex"
"""
import json
import os
import uuid
import warnings
import requests

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
    "Вместо персональных данных используй: [ФИО], [АДРЕС], [ДАТА], [СУММА]. "
    "Ответ до 400 слов. "
    "В конце: 'Документ подготовлен AI. Рекомендуется проверка у практикующего юриста.'"
)

DOC_PROMPTS = {
    "claim": "Составь исковое заявление в районный суд по ситуации: {details}",
    "complaint": "Составь жалобу в Роспотребнадзор по ситуации: {details}",
    "pretension": "Составь досудебную претензию по ситуации: {details}",
    "contract": "Составь договор ГПХ по ситуации: {details}",
    "business_contract": "Составь договор для бизнеса по ситуации: {details}",
}

YANDEX_MODEL = "gpt://b1gd8kncmd8nf4j7h770/yandexgpt-5.1/latest"


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
        timeout=15,
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
        timeout=50,
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
        timeout=50,
    )
    resp.raise_for_status()
    return resp.json()["result"]["alternatives"][0]["message"]["text"]


def handler(event: dict, context) -> dict:
    """AI-юрист: поддерживает GigaChat и YandexGPT. Параметр engine: 'gigachat' | 'yandex'."""
    cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
        mode = body.get("mode", "chat")
        engine = body.get("engine", "yandex")

        if mode == "document":
            doc_type = body.get("doc_type", "claim")
            details = body.get("details", "")
            if not details:
                return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "details required"})}
            prompt = DOC_PROMPTS.get(doc_type, DOC_PROMPTS["claim"]).format(details=details)
            user_messages = [{"role": "user", "content": prompt}]
            system = SYSTEM_DOCUMENT
            max_tokens = 600
        else:
            user_messages = body.get("messages", [])
            if not user_messages:
                return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "messages required"})}
            system = SYSTEM_CHAT
            max_tokens = 512

        if engine == "yandex":
            answer = call_yandex(system, user_messages, max_tokens)
        else:
            answer = call_gigachat(system, user_messages, max_tokens)

        return {
            "statusCode": 200,
            "headers": {**cors, "Content-Type": "application/json"},
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
            "headers": cors,
            "body": json.dumps({"error": f"HTTP {code}: {detail}"}, ensure_ascii=False),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": cors,
            "body": json.dumps({"error": str(e)}),
        }