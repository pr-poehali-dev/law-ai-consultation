"""Определение конкретного суда РФ по адресу и типу спора через YandexGPT."""
import json
import os
import re
import urllib.request
import urllib.error

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

YANDEX_API = "https://llm.api.cloud.yandex.net/v1/chat/completions"


def _call_gpt(system_prompt: str, user_message: str, api_key: str) -> str:
    payload = json.dumps({
        "model": "gpt://b1gd8kncmd8nf4j7h770/deepseek-v32/latest",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
        "max_tokens": 600,
        "temperature": 0.1,
        "stream": False,
    }, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(
        YANDEX_API,
        data=payload,
        headers={
            "Authorization": f"Api-Key {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            data = json.loads(r.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"YandexGPT HTTP {e.code}: {body[:200]}")


def _err(code: int, msg: str) -> dict:
    return {
        "statusCode": code,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({"error": msg}, ensure_ascii=False),
    }


def _ok(data: dict) -> dict:
    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(data, ensure_ascii=False),
    }


def handler(event: dict, context) -> dict:
    """Определяет конкретный суд РФ по адресу ответчика и типу спора через YandexGPT."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    if event.get("httpMethod") == "GET":
        return _ok({"ok": True, "service": "court-finder"})

    body: dict = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            return _err(400, "Невалидный JSON")

    defendant_address = (body.get("defendant_address") or "").strip()
    plaintiff_address = (body.get("plaintiff_address") or "").strip()
    court_type        = (body.get("court_type") or "general").strip()   # general | arbitration | ip
    case_category     = (body.get("case_category") or "general").strip()
    jurisdiction_rule = (body.get("jurisdiction_rule") or "").strip()
    article           = (body.get("article") or "").strip()

    if not defendant_address:
        return _err(400, "Укажите адрес ответчика")

    api_key = os.environ.get("YANDEX_IAM_TOKEN", "").strip()
    if not api_key:
        return _err(503, "YANDEX_IAM_TOKEN не настроен")

    court_type_label = {
        "arbitration": "арбитражный суд субъекта РФ",
        "ip":          "Суд по интеллектуальным правам (г. Москва)",
    }.get(court_type, "районный или городской суд общей юрисдикции")

    system_prompt = """Ты — справочная система судов Российской Федерации.
Твоя задача: по адресу и параметрам спора определить КОНКРЕТНЫЙ суд и вернуть его данные.

ВАЖНО: отвечай СТРОГО только JSON-объектом. Никакого другого текста до или после JSON.

Формат ответа:
{"name":"официальное полное наименование суда","address":"почтовый адрес суда с индексом","phone":"телефон канцелярии или пустая строка","website":"https://официальный сайт"}

Правила:
1. name — официальное полное наименование (например: "Симферопольский районный суд Республики Крым", "Арбитражный суд Краснодарского края", "Черёмушкинский районный суд г. Москвы")
2. address — АДРЕС СУДА (не адрес ответчика!), с почтовым индексом
3. phone — телефон приёмной/канцелярии суда (если не знаешь точно — верни пустую строку "")
4. website — официальный сайт суда (arbitr.ru для арбитражных, sudrf.ru или региональный для общих)
5. Для Москвы — указывай конкретный районный суд по округу/адресу
6. Для крупных городов с несколькими районными судами — выбирай по адресу ответчика
7. Для малых городов и районов — городской или районный суд того муниципального района"""

    user_message_parts = [
        f"Тип суда: {court_type_label}",
        f"Адрес ответчика: {defendant_address}",
    ]
    if plaintiff_address:
        user_message_parts.append(f"Адрес истца: {plaintiff_address}")
    if case_category:
        category_map = {
            "consumer": "защита прав потребителей",
            "labor": "трудовой спор",
            "children": "алименты/дети",
            "divorce": "расторжение брака",
            "harm": "возмещение вреда",
            "realestate": "спор о недвижимости",
            "inheritance": "наследство",
            "ip_rights": "интеллектуальная собственность",
            "general": "общий спор",
        }
        user_message_parts.append(f"Категория спора: {category_map.get(case_category, case_category)}")
    if jurisdiction_rule:
        user_message_parts.append(f"Правило подсудности: {jurisdiction_rule}")
    if article:
        user_message_parts.append(f"Правовое основание: {article}")

    user_message = "\n".join(user_message_parts)
    print(f"[COURT_FINDER] request: {user_message}")

    try:
        answer = _call_gpt(system_prompt, user_message, api_key)
        print(f"[COURT_FINDER] GPT answer: {answer[:300]}")

        # Парсим JSON из ответа
        json_match = re.search(r"\{[\s\S]*?\}", answer)
        if not json_match:
            # Пробуем достроить обрезанный JSON
            json_start = answer.find("{")
            if json_start >= 0:
                fragment = answer[json_start:]
                # Извлекаем поля регулярками напрямую
                def _extract(field: str) -> str:
                    m = re.search(rf'"{field}"\s*:\s*"([^"]*)"', fragment)
                    return m.group(1) if m else ""
                name = _extract("name")
                if name:
                    return _ok({
                        "name":    name,
                        "address": _extract("address"),
                        "phone":   _extract("phone"),
                        "website": _extract("website"),
                        "source":  "DeepSeek",
                    })
            return _err(502, f"GPT не вернул JSON: {answer[:200]}")

        try:
            court_data = json.loads(json_match.group(0))
        except json.JSONDecodeError:
            # JSON обрезан — парсим поля вручную
            fragment = json_match.group(0)
            def _extract(field: str) -> str:
                m = re.search(rf'"{field}"\s*:\s*"([^"]*)"', fragment)
                return m.group(1) if m else ""
            court_data = {
                "name":    _extract("name"),
                "address": _extract("address"),
                "phone":   _extract("phone"),
                "website": _extract("website"),
            }

        if not court_data.get("name"):
            return _err(502, "GPT не определил название суда")

        return _ok({
            "name":    court_data.get("name", ""),
            "address": court_data.get("address", ""),
            "phone":   court_data.get("phone", ""),
            "website": court_data.get("website", ""),
            "source":  "DeepSeek",
        })

    except json.JSONDecodeError as e:
        return _err(502, f"Ошибка парсинга JSON: {e}")
    except RuntimeError as e:
        return _err(502, str(e))