"""
AI-юрист на базе GigaChat API (Сбер).
mode: "chat" (консультация) | "document" (генерация документа)
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


def get_auth_header() -> str:
    """
    Возвращает готовый Authorization key из секрета GIGACHAT_AUTH_KEY.
    Это Base64-строка из кабинета Сбера (кнопка 'Скопировать ключ авторизации').
    Используется напрямую в заголовке: Authorization: Basic <key>
    """
    return os.environ["GIGACHAT_AUTH_KEY"].strip()


def get_token() -> str:
    auth_header = get_auth_header()
    resp = requests.post(
        "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
        headers={
            "Authorization": f"Basic {auth_header}",
            "RqUID": str(uuid.uuid4()),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"scope": "GIGACHAT_API_PERS"},
        verify=False,
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def call_ai(token: str, system_prompt: str, messages: list, max_tokens: int = 512) -> str:
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


def handler(event: dict, context) -> dict:
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
        token = get_token()

        if mode == "document":
            doc_type = body.get("doc_type", "claim")
            details = body.get("details", "")
            if not details:
                return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "details required"})}
            prompt = DOC_PROMPTS.get(doc_type, DOC_PROMPTS["claim"]).format(details=details)
            answer = call_ai(token, SYSTEM_DOCUMENT, [{"role": "user", "content": prompt}], max_tokens=600)
        else:
            messages = body.get("messages", [])
            if not messages:
                return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "messages required"})}
            answer = call_ai(token, SYSTEM_CHAT, messages, max_tokens=512)

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