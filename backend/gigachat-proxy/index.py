"""
Единый API: AI-юрист (YandexGPT) + авторизация.
mode: "chat" | "doc_chat" | "doc_generate"
auth actions: register, login, me, logout, update-profile, consume-question, add-paid-service
"""
import json
import os
import warnings
import requests
from datetime import date

from auth_handler import (
    handle_register, handle_login, handle_me,
    handle_logout, handle_update_profile,
    handle_consume_question, handle_add_paid_service,
)

warnings.filterwarnings("ignore")

TODAY = date.today().strftime("%d.%m.%Y")

# ───────────────────────────────────────────────
# СИСТЕМНЫЙ ПРОМПТ — КОНСУЛЬТАЦИЯ
# ───────────────────────────────────────────────
SYSTEM_CHAT = f"""Ты — юрист широкого профиля (гражданское, семейное, трудовое, жилищное, административное, налоговое, процессуальное право).
Текущая дата: {TODAY}.
Ты работаешь ТОЛЬКО в режиме консультации — разъясняешь нормы закона, анализируешь ситуацию, помогаешь понять права и риски.

ОСНОВНОЕ ТРЕБОВАНИЕ: каждый тезис подкрепляй ссылкой на статью ГК/ТК/СК/КоАП/НК/АПК/ГПК РФ.
Запрещены фразы «по закону», «согласно законодательству» — только «согласно ст. ___ ГК/ТК/СК/КоАП РФ».
Если точной статьи нет — пиши: «Прямой нормы не найдено, применяется аналогия закона (ст. 6 ГК РФ)».

АВТОМАТИЧЕСКИЙ ПОИСК: перед каждым ответом мысленно обновляй знание об актуальных редакциях норм и судебной практике (постановления Пленума ВС РФ, обзоры ВС РФ). В ответе не пиши «я нашёл», «поиск показал» — выдавай информацию как уже известную.

ЗАПРЕЩЕНО:
- Придумывать номера статей, дел и судебную практику.
- По уголовным делам — метка [УГОЛОВНАЯ ОПАСНОСТЬ] и направление к адвокату.
- СОСТАВЛЯТЬ ДОКУМЕНТЫ (иски, договоры, претензии, жалобы и т.д.) — при любом запросе на составление документа вежливо сообщай: «Для подготовки документов перейдите в раздел "Документы" — там AI-юрист составит полный документ с вашими реквизитами.»

Шаблон ответа на консультацию:
1. ПРАВОВАЯ КВАЛИФИКАЦИЯ (ключевая норма)
2. ЧТО МОЖНО СДЕЛАТЬ САМОСТОЯТЕЛЬНО (3–5 шагов со ссылками на статьи)
3. КОГДА НУЖЕН ЮРИСТ (сигналы опасности)
4. СУДЕБНАЯ ПЕРСПЕКТИВА (шансы, риски, сроки — ст. 196 ГК РФ)
5. КЛЮЧЕВЫЕ СТАТЬИ

Если фактов не хватает — задай ровно 3 уточняющих вопроса.
Ответ до 500 слов."""

# ───────────────────────────────────────────────
# СИСТЕМНЫЙ ПРОМПТ — ДИАЛОГ ДЛЯ ДОКУМЕНТОВ
# ───────────────────────────────────────────────
SYSTEM_DOC_CHAT = f"""Ты — юрист-документовед, специализирующийся на подготовке юридических документов по законодательству РФ.
Текущая дата: {TODAY}.

Твоя задача на этапе диалога: собрать все необходимые данные для подготовки документа.

ПРАВИЛА ДИАЛОГА:
1. Задавай уточняющие вопросы — по 1–3 за раз, чётко и конкретно.
2. Собери: реквизиты всех сторон (ФИО/название, адрес, ИНН/ОГРН), предмет, суммы, даты, обстоятельства.
3. Для договоров дополнительно: срок, порядок оплаты, ответственность, подсудность.
4. Для исков: цену иска, суд, доказательства.
5. Когда данных достаточно — напиши ТОЛЬКО строку: ##READY## и больше ничего.

ЗАПРЕЩЕНО на этапе диалога:
- Составлять сам документ.
- Давать юридические советы.
- Писать ##READY## раньше, чем собраны реквизиты обеих сторон и суть ситуации."""

# ───────────────────────────────────────────────
# СИСТЕМНЫЙ ПРОМПТ — ГЕНЕРАЦИЯ ДОКУМЕНТА
# ───────────────────────────────────────────────
SYSTEM_DOC_GENERATE = f"""Ты — юрист широкого профиля (гражданское, семейное, трудовое, жилищное, административное, налоговое, процессуальное право).
Текущая дата: {TODAY}.

ОСНОВНОЕ ТРЕБОВАНИЕ: Каждый тезис подкрепляй ссылкой на статью ГК/ТК/СК/КоАП/НК/АПК/ГПК РФ. Запрещены фразы «по закону», «согласно законодательству». Если точной статьи нет — напиши: «Прямой нормы не найдено, применяется аналогия закона (ст. 6 ГК РФ)».

ЗАПРЕЩЕНО: придумывать номера статей, дел, обзоров.

═══════════════════
СТРУКТУРА ДОКУМЕНТА (строго соблюдать)
═══════════════════

Документ должен состоять из чётких блоков. Каждый блок начинай с маркера на отдельной строке:

[ШАПКА]
Кому, от кого (ФИО, адрес, телефон). Для исков — цена иска и госпошлина.

[ЗАГОЛОВОК]
Наименование документа заглавными буквами по центру (например: ИСКОВОЕ ЗАЯВЛЕНИЕ).

[ТЕЛО]
Описательная часть: хронология событий, факты, ссылки на статьи. Абзацы разделяй пустой строкой.

[ТРЕБОВАНИЯ]
Нумерованные пункты (1., 2., 3. …). Каждый пункт — одно конкретное требование.

[ПРИЛОЖЕНИЯ]
Перечень прилагаемых документов, каждый с новой строки и номером.

[ПОДПИСЬ]
Справа: ФИО, отметка [ПОДПИСЬ]. Ниже: дата.

[ОБОСНОВАНИЕ]
Перечень применённых статей законов.

[ПРИМЕЧАНИЯ]
Что вписать вручную, что приложить, сроки подачи.

═══════════════════
ПРАВИЛА ПО ВИДАМ ДОКУМЕНТОВ
═══════════════════

ДЛЯ ИСКОВ (ст. 131–132 ГПК РФ / ст. 125 АПК РФ):
- Цена иска цифрой и прописью
- Госпошлина: ст. 333.19 НК РФ (общие суды) или ст. 333.21 НК РФ (арбитраж) с формулой расчёта
- КБК: 182 1 08 03010 01 1050 110 (общие) / 182 1 08 01000 01 1050 110 (арбитраж)
- Подсудность: ст. 28 ГПК РФ или ст. 35 АПК РФ
- Расчёт взыскиваемой суммы отдельным блоком

ДЛЯ ДОГОВОРОВ (ст. 432 ГК РФ):
- Существенные условия: предмет, цена, сроки, стороны
- Ответственность: ст. 330 ГК РФ (неустойка)
- Расторжение: ст. 450–453 ГК РФ
- Форс-мажор: ст. 401 ГК РФ
- Подсудность, конфиденциальность, комплаенс

ДЛЯ ПРЕТЕНЗИЙ:
- Срок ответа: ст. 165.1 ГК РФ

ДЛЯ ЖАЛОБ:
- Срок обжалования: ст. 256 КАС РФ, ст. 259 АПК РФ, ст. 30.3 КоАП РФ

═══════════════════
ПРАВИЛА ПО РЕКВИЗИТАМ
═══════════════════

- Все переданные пользователем данные (ФИО, адреса, ИНН, суммы, даты) вставляй в текст напрямую.
- Незаполненные/неизвестные поля обозначай ТОЛЬКО меткой в формате {{{{ПОЛЕ}}}}, например:
  {{{{ФИО_ИСТЦА}}}}, {{{{АДРЕС_ИСТЦА}}}}, {{{{ФИО_ОТВЕТЧИКА}}}}, {{{{АДРЕС_ОТВЕТЧИКА}}}},
  {{{{ИНН_ОТВЕТЧИКА}}}}, {{{{СУММА_ИСКА}}}}, {{{{ДАТА_НАРУШЕНИЯ}}}}, {{{{НОМЕР_ДОГОВОРА}}}}.
- Метки пишутся строго на русском языке с подчёркиванием между словами.
- Запрещено использовать [...], ___, или другие форматы заглушек.

Объём основного документа: 500–900 слов."""

# ───────────────────────────────────────────────
# Промпты для первого сообщения в диалоге
# ───────────────────────────────────────────────
DOC_STARTERS = {
    "claim": "Помогу подготовить исковое заявление. Для начала расскажите: кто подаёт иск и против кого? Укажите ФИО (или название организации) и адреса обеих сторон.",
    "pretension": "Помогу составить досудебную претензию. Для начала: кто направляет претензию и кому? Укажите ФИО/название и адреса обеих сторон.",
    "complaint": "Помогу подготовить жалобу в Роспотребнадзор. Для начала: ваши ФИО и адрес регистрации, а также название и адрес организации, на которую жалуетесь.",
    "contract": "Помогу составить договор ГПХ. Для начала: данные Заказчика — ФИО (или название организации), адрес, ИНН. Кто будет второй стороной — физлицо или ИП?",
    "business_contract": "Помогу подготовить коммерческий договор. Для начала: данные первой стороны — название организации, ИНН, юридический адрес, ФИО и должность руководителя.",
}

# Маркеры отказа YandexGPT
REFUSAL_MARKERS = [
    "не могу обсуждать",
    "не могу помочь",
    "не в состоянии",
    "давайте поговорим о чём",
    "предлагаю сменить тему",
    "не буду обсуждать",
    "нет возможности",
    "не предназначен для",
]

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
        headers={"Authorization": f"Api-Key {iam_token}", "Content-Type": "application/json"},
        json={
            "modelUri": YANDEX_MODEL,
            "completionOptions": {"stream": False, "temperature": 0.4, "maxTokens": max_tokens},
            "messages": [{"role": "system", "text": system_prompt}] + yandex_messages,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["result"]["alternatives"][0]["message"]["text"]


def call_yandex(system_prompt: str, messages: list, max_tokens: int = 600) -> str:
    yandex_messages = [
        {"role": "user" if m.get("role") == "user" else "assistant", "text": m.get("content", "")}
        for m in messages
    ]
    answer = _call_yandex_raw(system_prompt, yandex_messages, max_tokens)

    if is_refusal(answer) and yandex_messages:
        last = yandex_messages[-1]["text"]
        rephrased = yandex_messages[:-1] + [{
            "role": "user",
            "text": f"Объясни, какие нормы законодательства РФ применяются в следующей ситуации (только статьи и факты): {last}"
        }]
        answer = _call_yandex_raw(system_prompt, rephrased, max_tokens)

    return answer


def handler(event: dict, context) -> dict:
    """AI-юрист (YandexGPT) + авторизация. Режимы: chat, doc_chat, doc_generate."""
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
            return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"error": result["error"]}, ensure_ascii=False)}
        return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps(result.get("data", {}), ensure_ascii=False)}

    # --- AI ---
    try:
        mode = body.get("mode", "chat")

        # ── Генерация документа из описания пользователя ──
        if mode == "doc_generate":
            doc_type = body.get("doc_type", "claim")
            details = body.get("details", "").strip()
            if not details:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "details required"})}
            doc_labels = {
                "claim": "исковое заявление",
                "pretension": "досудебную претензию",
                "complaint": "жалобу в Роспотребнадзор",
                "contract": "договор ГПХ",
                "business_contract": "коммерческий договор",
            }
            label = doc_labels.get(doc_type, "документ")
            # Реквизиты будут заполнены позже — используем заглушки
            prompt = (
                f"Составь {label} на основании следующего описания ситуации:\n\n{details}\n\n"
                f"Там где не хватает конкретных данных о сторонах (ФИО, адрес, ИНН и т.д.) — "
                f"используй чёткие метки-заглушки в формате {{{{ПОЛЕ}}}}, например: "
                f"{{{{ФИО_ИСТЦА}}}}, {{{{АДРЕС_ИСТЦА}}}}, {{{{ФИО_ОТВЕТЧИКА}}}}, {{{{АДРЕС_ОТВЕТЧИКА}}}}, "
                f"{{{{ИНН}}}}, {{{{СУММА}}}}, {{{{ДАТА}}}}. "
                f"Метки должны быть чёткими и понятными — пользователь заполнит их вручную."
            )
            answer = call_yandex(SYSTEM_DOC_GENERATE, [{"role": "user", "content": prompt}], max_tokens=1500)
            # Извлекаем все метки {{...}} для передачи на фронт
            import re
            placeholders = list(dict.fromkeys(re.findall(r'\{\{([^}]+)\}\}', answer)))
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer, "placeholders": placeholders}, ensure_ascii=False)}

        # ── Обычный чат-консультация ──
        else:
            messages = body.get("messages", [])
            if not messages:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "messages required"})}
            answer = call_yandex(SYSTEM_CHAT, messages, max_tokens=700)
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer}, ensure_ascii=False)}

    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 0
        try:
            detail = e.response.json()
        except Exception:
            detail = e.response.text[:300] if e.response else ""
        return {"statusCode": 502, "headers": CORS,
                "body": json.dumps({"error": f"HTTP {code}: {detail}"}, ensure_ascii=False)}
    except Exception as e:
        return {"statusCode": 500, "headers": CORS, "body": json.dumps({"error": str(e)})}