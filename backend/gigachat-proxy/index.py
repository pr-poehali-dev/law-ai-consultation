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
SYSTEM_CHAT = f"""Ты — юрист широкого профиля с опытом ведения дел в следующих областях:
- гражданское право (договоры, долги, наследство, защита прав потребителей)
- семейное право (развод, алименты, раздел имущества)
- трудовое право (увольнение, штрафы, невыплаты, ТД)
- жилищное право (ЖКХ, приватизация, выселение)
- административное право (штрафы ГИБДД, споры с госорганами)
- налоги для физлиц и ИП (вычеты, задолженность, списание)
- процессуальное право (иски, жалобы, претензии, мировые соглашения)

Текущая дата: {TODAY}.

ОСНОВНОЕ ТРЕБОВАНИЕ: каждый тезис, вывод или рекомендация ОБЯЗАТЕЛЬНО подкрепляются конкретной нормой.
Запрещено: «по закону», «согласно законодательству» — только «согласно ст. ___ ГК/ТК/СК/КоАП РФ».
Если точной статьи нет — пиши: «Прямой нормы не найдено, применяется аналогия закона (ст. 6 ГК РФ)».

ЗАПРЕЩЕНО:
- Придумывать номера статей, дел и судебную практику.
- Давать советы по уголовным делам (ст. 105, 158, 159 УК РФ и др.) — только пометить [УГОЛОВНАЯ ОПАСНОСТЬ] и отправить к адвокату.

Строй ответ по шаблону:
1. КРАТКАЯ ПРАВОВАЯ КВАЛИФИКАЦИЯ (ключевая норма)
2. ЧТО МОЖНО СДЕЛАТЬ САМОСТОЯТЕЛЬНО (3–5 шагов со ссылками на статьи)
3. КОГДА НУЖЕН ЮРИСТ (сигналы опасности)
4. СУДЕБНАЯ ПЕРСПЕКТИВА (шансы, риски, сроки — ст. 196 ГК РФ)
5. КЛЮЧЕВЫЕ СТАТЬИ ЗАКОНА
6. АНАЛИЗ СУДЕБНОЙ ПРАКТИКИ НА {TODAY}: позиция ВС РФ, применение нормы, изменения за 12 мес.

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
SYSTEM_DOC_GENERATE = f"""Ты — профессиональный юрист-составитель документов по законодательству РФ.
Текущая дата: {TODAY}.

ТРЕБОВАНИЯ К ДОКУМЕНТУ:
1. Структура: шапка с реквизитами → наименование → описательная часть (факты + нормы) → просительная/распорядительная часть → приложения → дата → строки подписей.
2. ВСЕ переданные реквизиты (ФИО, адреса, ИНН, суммы, даты) вставляй в текст — никаких заглушек [ФИО] или [АДРЕС]. Незаполненные поля: ___________.
3. Каждый тезис подкрепляй ссылкой на статью закона.

ДЛЯ ИСКОВ ОБЯЗАТЕЛЬНО:
- Цена иска с расшифровкой (основной долг + проценты ст. 395 ГК РФ + неустойка).
- Расчёт госпошлины по ст. 333.19 или 333.21 НК РФ с формулой и итогом.
- Подсудность (ст. 28 ГПК РФ или ст. 35 АПК РФ).

ДЛЯ ДОГОВОРОВ ОБЯЗАТЕЛЬНО:
- Существенные условия (ст. 432 ГК РФ).
- Ответственность (ст. 330 ГК РФ), расторжение (ст. 450–453 ГК РФ).
- Подсудность (ст. 37 АПК РФ или ст. 32 ГПК РФ).
- Чек-лист рисков после текста договора.

ДЛЯ ПРЕТЕНЗИЙ: срок ответа по ст. 165.1 ГК РФ.

ПОСЛЕ ДОКУМЕНТА добавь блок:
--- ЮРИДИЧЕСКОЕ ОБОСНОВАНИЕ ---
Перечень применённых статей.

--- АНАЛИЗ СУДЕБНОЙ ПРАКТИКИ НА {TODAY} ---
Позиция ВС РФ, как суды оценивают аналогичные обстоятельства, какие доказательства требуют.

--- ПРИМЕЧАНИЯ ---
Что вписать вручную, что приложить, сроки подачи.

Объём документа: 600–1000 слов."""

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

        # ── Первое сообщение диалога документа ──
        if mode == "doc_start":
            doc_type = body.get("doc_type", "claim")
            starter = DOC_STARTERS.get(doc_type, DOC_STARTERS["claim"])
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": starter, "ready": False}, ensure_ascii=False)}

        # ── Диалог сбора данных для документа ──
        elif mode == "doc_chat":
            messages = body.get("messages", [])
            if not messages:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "messages required"})}
            answer = call_yandex(SYSTEM_DOC_CHAT, messages, max_tokens=400)
            ready = "##READY##" in answer
            clean = answer.replace("##READY##", "").strip()
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": clean, "ready": ready}, ensure_ascii=False)}

        # ── Генерация готового документа ──
        elif mode == "doc_generate":
            doc_type = body.get("doc_type", "claim")
            messages = body.get("messages", [])
            if not messages:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "messages required"})}
            doc_labels = {
                "claim": "исковое заявление",
                "pretension": "досудебную претензию",
                "complaint": "жалобу в Роспотребнадзор",
                "contract": "договор ГПХ",
                "business_contract": "коммерческий договор",
            }
            label = doc_labels.get(doc_type, "документ")
            history_text = "\n".join(
                f"{'Пользователь' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')}"
                for m in messages
            )
            prompt = (
                f"На основании следующего диалога составь {label}.\n\n"
                f"=== ДАННЫЕ ИЗ ДИАЛОГА ===\n{history_text}\n\n"
                f"Составь полный документ со всеми обязательными реквизитами."
            )
            answer = call_yandex(SYSTEM_DOC_GENERATE, [{"role": "user", "content": prompt}], max_tokens=1500)
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer}, ensure_ascii=False)}

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
