"""
AI-юрист на базе OpenAI GPT-4o-mini.
mode: "chat" (консультация) | "document" (генерация документа)
"""
import json
import os
import requests


SYSTEM_CHAT = (
    "Ты — профессиональный AI-юрист, специализирующийся на законодательстве Российской Федерации. "
    "Отвечай чётко и структурированно, ссылайся на конкретные статьи законов (ГК РФ, ТК РФ, ЖК РФ, ЗоЗПП, УК РФ, КоАП РФ). "
    "Давай практические рекомендации что делать в данной ситуации. "
    "В конце каждого ответа добавляй: 'Ответ подготовлен AI на основе базы знаний юристов. Не заменяет индивидуальную консультацию специалиста.'"
)

SYSTEM_DOCUMENT = (
    "Ты — профессиональный юрист-составитель документов по законодательству РФ. "
    "Составляй документы строго по установленным правовым формам: с реквизитами, шапкой, основной частью, датой и строками для подписей. "
    "Используй официальный юридический язык. Вместо персональных данных вставляй плейсхолдеры: [ФИО истца], [АДРЕС], [ДАТА], [СУММА] и т.п. "
    "В конце документа добавляй: 'Документ подготовлен AI на основе базы знаний юристов. Рекомендуется проверка у практикующего юриста.'"
)

DOC_PROMPTS = {
    "claim": "Составь исковое заявление в районный суд общей юрисдикции по следующей ситуации: {details}",
    "complaint": "Составь жалобу в Роспотребнадзор по следующей ситуации: {details}",
    "pretension": "Составь досудебную претензию по следующей ситуации: {details}",
    "contract": "Составь договор гражданско-правового характера (ГПХ) по следующей ситуации: {details}",
    "business_contract": "Составь юридически грамотный договор для бизнеса по следующей ситуации: {details}",
}


def call_openai(system_prompt: str, messages: list, max_tokens: int = 800) -> str:
    api_key = os.environ["OPENAI_API_KEY"]
    payload = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
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

        if mode == "document":
            doc_type = body.get("doc_type", "claim")
            details = body.get("details", "")
            if not details:
                return {
                    "statusCode": 400,
                    "headers": cors,
                    "body": json.dumps({"error": "details required"}),
                }
            prompt_template = DOC_PROMPTS.get(doc_type, DOC_PROMPTS["claim"])
            user_prompt = prompt_template.format(details=details)
            answer = call_openai(
                SYSTEM_DOCUMENT,
                [{"role": "user", "content": user_prompt}],
                max_tokens=1200,
            )
        else:
            messages = body.get("messages", [])
            if not messages:
                return {
                    "statusCode": 400,
                    "headers": cors,
                    "body": json.dumps({"error": "messages required"}),
                }
            answer = call_openai(SYSTEM_CHAT, messages, max_tokens=800)

        return {
            "statusCode": 200,
            "headers": {**cors, "Content-Type": "application/json"},
            "body": json.dumps({"answer": answer}, ensure_ascii=False),
        }

    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 0
        msg = "Неверный API ключ" if code == 401 else f"Ошибка AI-сервиса: {code}"
        return {
            "statusCode": 502,
            "headers": cors,
            "body": json.dumps({"error": msg}),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": cors,
            "body": json.dumps({"error": str(e)}),
        }
