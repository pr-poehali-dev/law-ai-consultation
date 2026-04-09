"""
Прокси для GigaChat API — консультации и генерация юридических документов.
mode: "chat" (консультация) | "document" (генерация документа)
"""
import json
import os
import uuid
import requests


SYSTEM_CHAT = (
    "Ты — AI-юрист, обученный на реальной судебной практике Российской Федерации. "
    "Отвечай строго по законодательству РФ: ГК, ТК, ЖК, ЗоЗПП, УК, КоАП и другим актуальным нормам. "
    "Давай чёткие, структурированные ответы с ссылками на конкретные статьи законов. "
    "В конце каждого ответа добавляй дисклеймер: "
    "'Ответ подготовлен AI на основе базы знаний юристов и не заменяет индивидуальную консультацию специалиста.'"
)

SYSTEM_DOCUMENT = (
    "Ты — опытный юрист-составитель документов. Твоя задача — генерировать профессиональные юридические документы "
    "по законодательству Российской Федерации. "
    "Составляй документы строго по установленным формам: с реквизитами, шапкой, датой, подписями. "
    "Используй официальный юридический язык. Там где нужны данные пользователя — вставляй плейсхолдеры в формате [ФИО], [АДРЕС] и т.п. "
    "Добавляй в конце: 'Документ сгенерирован AI. Рекомендуется проверка у практикующего юриста.'"
)

DOC_PROMPTS = {
    "claim": "Составь исковое заявление в районный суд общей юрисдикции. Тема: {details}",
    "complaint": "Составь жалобу в Роспотребнадзор. Тема: {details}",
    "pretension": "Составь досудебную претензию. Тема: {details}",
    "contract": "Составь договор гражданско-правового характера (ГПХ). Тема: {details}",
    "business_contract": "Составь юридически грамотный договор для бизнеса. Тема: {details}",
}


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


def call_gigachat(token: str, system_prompt: str, messages: list, max_tokens: int = 2048) -> str:
    resp = requests.post(
        "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={
            "model": "GigaChat",
            "messages": [{"role": "system", "content": system_prompt}] + messages,
            "temperature": 0.6,
            "max_tokens": max_tokens,
        },
        verify=False,
        timeout=55,
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
        auth_key = os.environ["GIGACHAT_AUTH_KEY"]
        token = get_token(auth_key)

        if mode == "document":
            doc_type = body.get("doc_type", "claim")
            details = body.get("details", "")
            if not details:
                return {
                    "statusCode": 400,
                    "headers": cors,
                    "body": json.dumps({"error": "details required for document mode"}),
                }
            prompt_template = DOC_PROMPTS.get(doc_type, DOC_PROMPTS["claim"])
            user_prompt = prompt_template.format(details=details)
            answer = call_gigachat(
                token,
                SYSTEM_DOCUMENT,
                [{"role": "user", "content": user_prompt}],
                max_tokens=2048,
            )
        else:
            messages = body.get("messages", [])
            if not messages:
                return {
                    "statusCode": 400,
                    "headers": cors,
                    "body": json.dumps({"error": "messages required"}),
                }
            answer = call_gigachat(token, SYSTEM_CHAT, messages, max_tokens=1024)

        return {
            "statusCode": 200,
            "headers": {**cors, "Content-Type": "application/json"},
            "body": json.dumps({"answer": answer}, ensure_ascii=False),
        }

    except requests.HTTPError as e:
        return {
            "statusCode": 502,
            "headers": cors,
            "body": json.dumps({"error": f"GigaChat error: {e.response.status_code}"}),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": cors,
            "body": json.dumps({"error": str(e)}),
        }
