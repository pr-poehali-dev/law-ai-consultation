"""
Единый API: AI-юрист (DeepSeek V3 via Yandex Cloud) + авторизация. v4 — prompts extracted. v5 — email notify. v6 — relay removed.
mode: "chat" | "doc_continue" | "business_chat" | "chat_continue"
auth actions: register, login, me, logout, update-profile, consume-question, add-paid-service
Этот модуль: chat-режимы. doc_generate → /doc-generate endpoint. file_analyze → /file-analyze endpoint.
"""
import json
import os
import re
import warnings
import time
import threading

import requests

from auth_handler import (
    handle_register, handle_login, handle_me,
    handle_logout, handle_update_profile,
    handle_consume_question, handle_consume_doc, handle_refund_doc, handle_add_paid_service,
    handle_report, handle_send_otp, handle_verify_otp, handle_forgot_password, handle_change_password, sanitize_str,
    handle_lawyer_send, handle_lawyer_messages,
    handle_admin_reports, handle_my_reports,
    handle_business_update_org, handle_business_consume_action,
    handle_business_messages_get, handle_business_messages_save,
    handle_get_billing_log, handle_list_users,
    handle_get_all_billing_log, handle_get_new_users,
    handle_admin_grant, handle_admin_search_user,
    handle_push_subscribe, handle_push_subscribe_anon, handle_get_vapid_public_key,
    handle_get_compute_stats, log_compute,
)
from prompts import (
    TODAY, SYSTEM_CHAT, SYSTEM_CHAT_SIMPLE, SYSTEM_DOC_GENERATE,
    SYSTEM_FILE_ANALYZE_PROMPT,
    SYSTEM_DOC_BY_TYPE, REFUSAL_MARKERS, SIMPLE_QUERY_MARKERS,
    SYSTEM_BUSINESS_CHAT, SYSTEM_BUSINESS_CONTRACT,
    SYSTEM_COUNTERPARTY_CHECK, SYSTEM_TAX_ANALYSIS,
    SYSTEM_CASE_LAW, SYSTEM_CHAT_DEEPSEEK,
    LEGAL_QUALITY_ADDON,
)
from state_duty import (
    is_duty_query, get_duty_context_for_chat, get_duty_context_for_doc,
    DUTY_DOC_TYPES,
)
from legal_docs_handler import (
    handle_legal_docs,
    get_legal_context_for_ai,
)

# Типы документов, для которых ораторский финал (не "подпись/реквизиты")
SPEECH_DOC_TYPES = {"court_speech"}

warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=UserWarning)

YANDEX_MODEL = os.environ.get("YANDEX_MODEL_URI", "gpt://b1gd8kncmd8nf4j7h770/deepseek-v32/latest")
# Быстрая модель для консультаций
YANDEX_MODEL_FAST = "gpt://b1gd8kncmd8nf4j7h770/yandexgpt/latest"

# HTTP-сессия с keep-alive — переиспользуется между вызовами в рамках одного контейнера
_http = requests.Session()
_http.headers.update({"Content-Type": "application/json"})

# IAM-токен кэшируем: .strip() дорогой при частых вызовах
_IAM_TOKEN: str = os.environ.get("YANDEX_IAM_TOKEN", "").strip()

# Прекомпилированные regex для частых проверок
_RE_TRUNCATED = re.compile(r'[.!?»\d]\s*$')
_RE_PLACEHOLDER = re.compile(r'\{\{([^}]+)\}\}')
_RE_DOC_END_SPEECH = re.compile(r'(прошу\s+суд|прошу\s+уважаемый|на\s+основании\s+изложенного|итог|в\s+заключение)', re.I)
_RE_DOC_END_OTHER = re.compile(r'(подпись|реквизиты|экземпляр|дата\s*[:|]?\s*«|\d{1,2}\.\d{2}\.\d{4})', re.I)


def _call_openai_compat(messages: list, max_tokens: int, temperature: float = 0.3, timeout: int = 120) -> str:
    resp = _http.post(
        "https://llm.api.cloud.yandex.net/v1/chat/completions",
        headers={"Authorization": f"Api-Key {_IAM_TOKEN}"},
        json={
            "model": YANDEX_MODEL,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def call_deepseek(system_prompt: str, messages: list, max_tokens: int = 800, temperature: float = 0.3, timeout: int = 45) -> tuple[str, bool]:
    """DeepSeek V3 через Яндекс Cloud. Возвращает (текст, был_ли_обрезан).
    timeout=45 для чата, 120 для генерации документов."""
    recent = messages[-MAX_HISTORY:] if len(messages) > MAX_HISTORY else messages
    openai_messages = [{"role": "system", "content": system_prompt}] + [
        {
            "role": "user" if m.get("role") == "user" else "assistant",
            "content": m.get("content", m.get("text", "")),
        }
        for m in recent
    ]
    resp = _http.post(
        "https://llm.api.cloud.yandex.net/v1/chat/completions",
        headers={"Authorization": f"Api-Key {_IAM_TOKEN}"},
        json={
            "model": YANDEX_MODEL,
            "messages": openai_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    choice = resp.json()["choices"][0]
    text = choice["message"]["content"] or ""
    was_cut = choice.get("finish_reason") == "length"
    if was_cut:
        print(f"[ROUTER] DeepSeek обрезан по токенам (finish_reason=length), симв={len(text)}")
    return text, was_cut


def _extract_deepseek_summary(answer: str) -> tuple[str, str]:
    """Извлекает [РЕЗЮМЕ] из ответа DeepSeek. Возвращает (текст_без_резюме, резюме)."""
    marker = "[РЕЗЮМЕ]:"
    idx = answer.rfind(marker)
    if idx == -1:
        # Пробуем без двоеточия
        marker = "[РЕЗЮМЕ]"
        idx = answer.rfind(marker)
    if idx == -1:
        return answer.strip(), ""
    main = answer[:idx].strip()
    summary = answer[idx + len(marker):].strip()
    return main, summary


def _sanitize_doc_text(text: str) -> str:
    """Заменяет персданные в тексте документа на плейсхолдеры.
    Это предотвращает отказ YandexGPT и ошибки обработки ПД.
    Имена/организации НЕ трогаем — они нужны для юридического анализа."""
    result = text
    for pattern, replacement in _PD_PATTERNS:
        result = pattern.sub(replacement, result)
    return result


CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}


def is_refusal(text) -> bool:
    if not text:
        return False
    low = text.lower()
    return any(m in low for m in REFUSAL_MARKERS)


# Паттерны персональных данных для очистки перед отправкой в YandexGPT
_PD_PATTERNS = [
    # СНИЛС: строго формат 000-000-000 00
    (re.compile(r'\b\d{3}-\d{3}-\d{3}\s\d{2}\b'), '{{СНИЛС}}'),
    # ИНН с явным указанием слова «ИНН»
    (re.compile(r'\bИНН[:\s]+\d{10,12}\b', re.IGNORECASE), '{{ИНН}}'),
    # ОГРН с явным указанием слова «ОГРН»
    (re.compile(r'\bОГРН[:\s]+\d{13,15}\b', re.IGNORECASE), '{{ОГРН}}'),
    # Серия и номер паспорта с контекстом (паспорт/серия/выдан + цифры)
    (re.compile(r'(паспорт|серия паспорта|выдан)[^,;\n]{0,40}\d{4}\s?\d{6}', re.IGNORECASE), '{{ПАСПОРТНЫЕ_ДАННЫЕ}}'),
    # Паспорт: серия номер без контекста — только если 4 цифры пробел 6 цифр
    (re.compile(r'(?<!\d)\d{4}\s\d{6}(?!\d)'), '{{ПАСПОРТ}}'),
    # Дата рождения только с явным контекстом
    (re.compile(r'(дата\s+рождения|д\.р\.|дата\sвыдачи|выдан\s+\d)[:\s]*\d{1,2}[./]\d{1,2}[./]\d{2,4}', re.IGNORECASE), '{{ДАТА}}'),
]

NOTICE_PD = (
    "В связи с политикой обработки данных и запретами сервиса я не могу использовать "
    "ваши личные реквизиты и данные некоторых государственных органов. "
    "После создания документа вы сможете заполнить их собственноручно в полях документа.\n\n"
    "Однако я проанализирую всё остальное.\n\n"
)


def strip_personal_data(messages: list) -> tuple:
    """Очищает последнее user-сообщение от персональных данных.
    Возвращает (очищенные messages, True если данные были найдены)."""
    if not messages:
        return messages, False

    cleaned = list(messages)
    last_idx = len(cleaned) - 1
    # Ищем последнее user-сообщение с конца
    for i in range(last_idx, -1, -1):
        if cleaned[i].get("role") == "user":
            original = cleaned[i].get("content", "")
            result = original
            found = False
            for pattern, replacement in _PD_PATTERNS:
                new_result = pattern.sub(replacement, result)
                if new_result != result:
                    found = True
                    result = new_result
            if found:
                cleaned[i] = {**cleaned[i], "content": result}
                return cleaned, True
            break
    return cleaned, False


MAX_HISTORY = 10
# Если история длиннее — первые сообщения сжимаем в резюме
SUMMARY_THRESHOLD = 14


def summarize_old_messages(messages: list) -> list:
    """Сжимает сообщения старше MAX_HISTORY в краткое резюме контекста.
    Возвращает список: [summary_msg] + последние MAX_HISTORY сообщений."""
    if len(messages) <= SUMMARY_THRESHOLD:
        return messages
    tail = messages[-MAX_HISTORY:]
    head = messages[:-MAX_HISTORY]
    # Формируем текст для сжатия
    dialog_text = "\n".join(
        f"{'Пользователь' if m.get('role') == 'user' else 'Юрист'}: {m.get('content', '')[:400]}"
        for m in head
    )
    summary_prompt = (
        "Сожми диалог в краткое резюме (3-5 предложений): "
        "кто обратился, суть правовой ситуации, ключевые факты (стороны, суммы, даты, нарушения). "
        "Только факты, без рекомендаций.\n\n" + dialog_text
    )
    try:
        resp = _http.post(
            "https://llm.api.cloud.yandex.net/v1/chat/completions",
            headers={"Authorization": f"Api-Key {_IAM_TOKEN}"},
            json={
                "model": YANDEX_MODEL_FAST,
                "messages": [{"role": "user", "content": summary_prompt}],
                "max_tokens": 300,
                "temperature": 0.2,
                "stream": False,
            },
            timeout=15,
        )
        resp.raise_for_status()
        summary = resp.json()["choices"][0]["message"]["content"].strip()
        summary_msg = {"role": "user", "content": f"[Контекст предыдущего диалога: {summary}]"}
        return [summary_msg] + tail
    except Exception:
        # При ошибке сжатия — просто обрезаем
        return tail


def is_simple_query(messages: list) -> bool:
    """Определяет является ли запрос простым информационным — без конкретного дела/спора."""
    if not messages:
        return False
    last_user = next((m for m in reversed(messages) if m.get("role") == "user"), None)
    if not last_user:
        return False
    text = last_user.get("content", "").lower().strip()
    # Длинные запросы (>120 символов) скорее всего описывают реальную ситуацию
    if len(text) > 120:
        return False
    return any(marker in text for marker in SIMPLE_QUERY_MARKERS)


_CASE_LAW_MARKERS = [
    "судебная практика", "судебной практике", "судебную практику", "судебной практикой",
    "аналогичные дела", "аналогичное дело", "похожие дела", "похожие случаи",
    "судебные решения", "решения судов", "решение суда по", "практика судов",
    "прецедент", "прецеденты", "как решают суды", "как суды решают",
    "выигрывают ли", "выигрывают такие дела", "шансы в суде",
    "судебные прецеденты", "найди дела", "найдите дела", "примеры из практики",
    "практика по таким делам", "что говорят суды",
]

def is_case_law_query(messages: list) -> bool:
    """Определяет является ли запрос о судебной практике / аналогичных делах."""
    if not messages:
        return False
    last_user = next((m for m in reversed(messages) if m.get("role") == "user"), None)
    if not last_user:
        return False
    text = last_user.get("content", "").lower()
    return any(marker in text for marker in _CASE_LAW_MARKERS)


_CASE_LAW_NOT_FOUND_MARKERS = [
    "не могу предоставить", "не могу найти", "нет доступа", "не имею доступа",
    "не могу осуществить поиск", "не могу провести поиск", "нет возможности",
    "не могу дать конкретные", "конкретные дела не могу", "базы судебных решений",
    "не обладаю", "у меня нет доступа", "актуальную практику не могу",
    "ограничен в доступе", "к сожалению, не могу", "судебные базы",
]

def is_case_law_not_found(answer) -> bool:
    """Определяет, не смог ли AI найти судебную практику."""
    if not answer:
        return True
    low = answer.lower()
    return any(marker in low for marker in _CASE_LAW_NOT_FOUND_MARKERS)


def call_yandex(system_prompt: str, messages: list, max_tokens: int = 1200, fast: bool = False, temperature: float = 0.3) -> str:
    recent = messages[-MAX_HISTORY:] if len(messages) > MAX_HISTORY else messages
    openai_messages = [{"role": "system", "content": system_prompt}] + [
        {
            "role": "user" if m.get("role") == "user" else "assistant",
            "content": m.get("content", m.get("text", "")),
        }
        for m in recent
    ]
    if fast:
        resp = _http.post(
            "https://llm.api.cloud.yandex.net/v1/chat/completions",
            headers={"Authorization": f"Api-Key {_IAM_TOKEN}"},
            json={"model": YANDEX_MODEL_FAST, "messages": openai_messages, "max_tokens": max_tokens, "temperature": temperature, "stream": False},
            timeout=45,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    return _call_openai_compat(openai_messages, max_tokens, temperature=temperature)



def handler(event: dict, context) -> dict:
    """AI-юрист (DeepSeek V3) + авторизация. Режимы: chat, business_chat, doc_continue."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    # Keep-alive ping — держит контейнер тёплым
    if event.get("httpMethod") == "GET":
        return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps({"ok": True})}

    headers = event.get("headers") or {}
    token = headers.get("X-Auth-Token") or headers.get("x-auth-token", "")

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    action = sanitize_str(body.get("action") or "", max_len=64)
    ip = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp", "")

    _me_cached = None
    def _get_me():
        nonlocal _me_cached
        if _me_cached is None:
            _me_cached = handle_me(token)
        return _me_cached

    _user_info_cached = None
    def _get_user_info():
        """Возвращает (user_id, email) из кэша — без повторного запроса в БД."""
        nonlocal _user_info_cached
        if _user_info_cached is None:
            me = _get_me()
            u = me.get("data", {}).get("user", me.get("data", {})) if "data" in me else {}
            _user_info_cached = (u.get("id"), u.get("email"))
        return _user_info_cached

    def _lawyer_send_action():
        me = _get_me()
        if "error" in me: return me
        u = me.get("data", {}).get("user", me.get("data", {}))
        uid = u.get("id")
        if not uid: return {"status": 401, "error": "Не авторизован"}
        return handle_lawyer_send(body, uid, u.get("isAdmin", False))

    def _lawyer_messages_action():
        me = _get_me()
        if "error" in me: return me
        u = me.get("data", {}).get("user", me.get("data", {}))
        uid = u.get("id")
        if not uid: return {"status": 401, "error": "Не авторизован"}
        return handle_lawyer_messages(body, uid, u.get("isAdmin", False))

    def _push_subscribe_action():
        me = _get_me()
        if "error" in me:
            return handle_push_subscribe_anon(body)
        u = me.get("data", {}).get("user", me.get("data", {}))
        uid = u.get("id")
        if not uid:
            return handle_push_subscribe_anon(body)
        return handle_push_subscribe(body, uid)

    auth_actions = {
        "register": lambda: handle_register(body),
        "login": lambda: handle_login(body, ip),
        "me": lambda: handle_me(token),
        "logout": lambda: handle_logout(token),
        "update-profile": lambda: handle_update_profile(token, body),
        "consume-question": lambda: handle_consume_question(token),
        "consume-doc": lambda: handle_consume_doc(token),
        "refund-doc": lambda: handle_refund_doc(token),
        "add-paid-service": lambda: handle_add_paid_service(token, body),
        "report": lambda: handle_report(token, body),
        "my-reports": lambda: handle_my_reports(token),
        "admin-reports": lambda: handle_admin_reports(token, body),
        "send-otp": lambda: handle_send_otp(body),
        "verify-otp": lambda: handle_verify_otp(body),
        "forgot-password": lambda: handle_forgot_password(body),
        "change-password": lambda: handle_change_password(token, body),
        "lawyer-send": _lawyer_send_action,
        "lawyer-messages": _lawyer_messages_action,
        "business-update-org": lambda: handle_business_update_org(token, body),
        "business-consume-action": lambda: handle_business_consume_action(token),
        "business-messages-get": lambda: handle_business_messages_get(token, body),
        "business-messages-save": lambda: handle_business_messages_save(token, body),
        "get-billing-log": lambda: handle_get_billing_log(token, body),
        "list-users": lambda: handle_list_users(token),
        "get-all-billing-log": lambda: handle_get_all_billing_log(token, body),
        "get-new-users": lambda: handle_get_new_users(token, body),
        "admin-grant": lambda: handle_admin_grant(token, body),
        "admin-search-user": lambda: handle_admin_search_user(token, body),
        "legal-docs": lambda: handle_legal_docs(token, body),
        "push-subscribe": lambda: _push_subscribe_action(),
        "push-subscribe-anon": lambda: handle_push_subscribe_anon(body),
        "vapid-public-key": lambda: handle_get_vapid_public_key(),
        "get-compute-stats": lambda: handle_get_compute_stats(token),
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

        # ── doc_generate переехал в отдельный endpoint ──
        if mode == "doc_generate":
            return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"error": "Use /doc-generate endpoint", "redirect": "doc_generate"}, ensure_ascii=False)}

        # ── file_analyze переехал в отдельный endpoint ──
        elif mode == "file_analyze":
            return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"error": "Use /file-analyze endpoint"}, ensure_ascii=False)}

        # ── Продолжение обрезанного документа ──
        elif mode == "doc_continue":
            doc_type = body.get("doc_type", "claim")
            partial = body.get("partial", "").strip()
            if not partial:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "partial required"})}
            system_prompt = SYSTEM_DOC_BY_TYPE.get(doc_type, SYSTEM_DOC_GENERATE)
            context_tail = partial[-800:]
            prompt = (
                f"Документ был обрезан. Продолжи с того места, где остановился, без повторения уже написанного.\n\n"
                f"Конец уже написанного текста:\n...{context_tail}\n\n"
                f"Продолжай документ до финального блока с реквизитами, подписями и датой. "
                f"Незаполненные поля — метки {{{{ПОЛЕ_НАЗВАНИЕ}}}}."
            )
            answer = call_yandex(system_prompt, [{"role": "user", "content": prompt}], max_tokens=3500, temperature=0.15)
            truncated = not bool(re.search(r'(подпись|реквизиты|экземпляр|дата\s*[:|]?\s*«|\d{1,2}\.\d{2}\.\d{4})', answer[-300:], re.I))
            placeholders = list(dict.fromkeys(re.findall(r'\{\{([^}]+)\}\}', answer)))
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer, "placeholders": placeholders, "truncated": truncated}, ensure_ascii=False)}

        # ── Бизнес-чат ──
        elif mode == "business_chat":
            biz_messages = body.get("messages", [])
            org_name = body.get("org_name", "").strip()
            biz_mode = body.get("biz_mode", "chat")
            if not biz_messages:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "messages required"})}

            # Файлы в бизнес-чате добавляются через /file-analyze endpoint
            file_texts = []

            # Добавляем текст файлов к последнему сообщению пользователя (если вдруг есть)
            if file_texts and biz_messages:
                last_msg = biz_messages[-1].copy()
                last_msg["content"] = last_msg.get("content", "") + "\n\n" + "\n\n".join(file_texts)
                biz_messages = biz_messages[:-1] + [last_msg]

            if biz_mode == "contract":
                sys_prompt = SYSTEM_BUSINESS_CONTRACT
            elif biz_mode == "counterparty":
                sys_prompt = SYSTEM_COUNTERPARTY_CHECK
            elif biz_mode == "tax":
                sys_prompt = SYSTEM_TAX_ANALYSIS
            elif biz_mode in ("doc_analyze", "doc_compare", "orders"):
                sys_prompt = SYSTEM_FILE_ANALYZE_PROMPT if biz_mode != "orders" else SYSTEM_DOC_BY_TYPE.get("order", SYSTEM_DOC_GENERATE)
            elif biz_mode == "pretension":
                sys_prompt = SYSTEM_DOC_BY_TYPE.get("biz_pretension", SYSTEM_DOC_GENERATE)
            else:
                sys_prompt = SYSTEM_BUSINESS_CHAT
                if org_name:
                    sys_prompt = sys_prompt + f"\n\nОрганизация клиента: {org_name}"

            # Для консультаций — быстрая модель, для документов — deepseek
            is_doc_mode = biz_mode in ("contract", "orders", "pretension")
            needs_expert = False
            personal_data_refused = False

            if is_doc_mode:
                trimmed = biz_messages
                answer = call_yandex(sys_prompt, trimmed, max_tokens=3500, fast=False, temperature=0.15)
            elif is_case_law_query(biz_messages):
                summarized_biz = summarize_old_messages(biz_messages)
                trimmed, had_pd = strip_personal_data(summarized_biz)
                answer = call_yandex(SYSTEM_CASE_LAW, trimmed, max_tokens=2500, fast=True, temperature=0.3)
                if is_case_law_not_found(answer):
                    needs_expert = True
                    answer = answer.rstrip()
                    answer += "\n\n---\nБолее детальный поиск судебной практики по вашему делу может провести наш юрист-эксперт — он имеет доступ к базам КонсультантПлюс и Гарант и подберёт конкретные решения судов по схожим ситуациям."
                elif had_pd:
                    answer = NOTICE_PD + answer
            else:
                # Сжимаем старые сообщения + очищаем персональные данные
                summarized_biz = summarize_old_messages(biz_messages)
                trimmed, had_pd = strip_personal_data(summarized_biz)
                # Бизнес-консультации — YandexGPT для скорости, t=0.3 для точности
                answer = call_yandex(sys_prompt, trimmed, max_tokens=2500, fast=True, temperature=0.3)
                personal_data_refused = False
                used_deepseek_biz = False
                if is_refusal(answer):
                    # Fallback на DeepSeek — как в обычном чате
                    print(f"[BIZ_ROUTER] YandexGPT отказал → fallback DeepSeek V3")
                    ds_raw, ds_cut_biz = call_deepseek(
                        SYSTEM_CHAT_DEEPSEEK,
                        summarized_biz,
                        max_tokens=1200,
                        temperature=0.3,
                    )
                    ds_main, _ = _extract_deepseek_summary(ds_raw)
                    answer = ds_main if ds_main else ds_raw
                    print(f"[BIZ_ROUTER] DeepSeek ответил, симв={len(answer)}, обрезан={ds_cut_biz}")
                    personal_data_refused = False
                    used_deepseek_biz = True
                elif had_pd:
                    answer = NOTICE_PD + answer

            # Определяем обрыв ответа (только для консультационных режимов)
            biz_truncated = False
            if not is_doc_mode:
                biz_truncated = len(answer) > 200 and not bool(_RE_TRUNCATED.search(answer.rstrip()))

            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer, "needs_expert": needs_expert, "truncated": biz_truncated, "personal_data_refused": personal_data_refused if not is_doc_mode else False}, ensure_ascii=False)}

        # ── Продолжение обрезанного ответа в чате ──
        elif mode == "chat_continue":
            messages = body.get("messages", [])
            partial = body.get("partial", "").strip()
            if not partial:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "partial required"})}
            cont_messages = list(messages) + [
                {"role": "assistant", "content": partial},
                {"role": "user", "content": "Продолжи ответ с того места, где остановился. Не повторяй уже написанное."},
            ]
            answer = call_yandex(SYSTEM_CHAT, cont_messages, max_tokens=1200, fast=True)
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer}, ensure_ascii=False)}

        # ── Обычный чат-консультация ──
        else:
            _chat_start = time.time()
            messages = body.get("messages", [])
            if not messages:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "messages required"})}

            # Определяем маршрут параллельно со сжатием истории
            is_system_mode = messages and messages[0].get("role") == "system"

            # Запускаем summarize в фоновом потоке — если история короткая, вернётся мгновенно
            _summary_result: list = []
            def _run_summary():
                _summary_result.append(summarize_old_messages(messages))
            _t_summary = threading.Thread(target=_run_summary, daemon=True)
            _t_summary.start()

            # Пока summarize выполняется — определяем маршрут на исходных сообщениях (не ждём)
            _is_case_law = is_case_law_query(messages)
            _is_duty = (not _is_case_law) and is_duty_query(messages)
            _is_simple = (not _is_case_law) and (not _is_duty) and is_simple_query(messages)

            # Ждём summarize (обычно уже готово, т.к. шло параллельно)
            _t_summary.join(timeout=12)
            summarized = _summary_result[0] if _summary_result else messages

            # Очищаем персональные данные до отправки в Яндекс
            clean_messages, had_pd = strip_personal_data(summarized)

            needs_expert = False
            personal_data_refused = False
            used_deepseek = False

            if is_system_mode:
                # Внутренний режим (определение типа документа и т.п.) — только Яндекс, без DeepSeek
                custom_system = messages[0].get("content", SYSTEM_CHAT)
                chat_messages = clean_messages[1:]
                answer = call_yandex(custom_system, chat_messages, max_tokens=1200, fast=True)

            elif _is_case_law:
                # Ищем релевантную практику из БД по тексту вопроса
                _last_user_q = next((m.get("content","") for m in reversed(clean_messages) if m.get("role") == "user"), "")
                case_law_db_ctx = get_legal_context_for_ai("case_law", max_files=3, max_chars=5000, query=_last_user_q)
                if case_law_db_ctx:
                    _case_law_msgs = list(clean_messages)
                    _lu_idx = next((i for i in range(len(_case_law_msgs)-1, -1, -1) if _case_law_msgs[i].get("role") == "user"), None)
                    if _lu_idx is not None:
                        _case_law_msgs[_lu_idx] = {**_case_law_msgs[_lu_idx], "content": _case_law_msgs[_lu_idx].get("content","") + case_law_db_ctx}
                    answer = call_yandex(SYSTEM_CASE_LAW, _case_law_msgs, max_tokens=1400, fast=True, temperature=0.3)
                    print(f"[ROUTER] Судебная практика из БД инжектирована по запросу")
                else:
                    answer = call_yandex(SYSTEM_CASE_LAW, clean_messages, max_tokens=1400, fast=True, temperature=0.3)
                if is_case_law_not_found(answer):
                    needs_expert = True
                    answer = answer.rstrip()
                    answer += "\n\n---\nБолее детальный поиск судебной практики по вашему делу может провести наш юрист-эксперт — он имеет доступ к базам КонсультантПлюс и Гарант и подберёт конкретные решения судов по схожим ситуациям."

            elif _is_duty:
                # Вопрос о госпошлине — инжектируем справочник ставок + файлы из БД
                duty_ctx = get_duty_context_for_chat()
                _last_user_q_duty = next((m.get("content","") for m in reversed(clean_messages) if m.get("role") == "user"), "")
                duty_db_ctx = get_legal_context_for_ai("state_duty", max_files=2, max_chars=5000, query=_last_user_q_duty)
                duty_messages = list(clean_messages)
                last_user_idx = next((i for i in range(len(duty_messages)-1, -1, -1)
                                      if duty_messages[i].get("role") == "user"), None)
                if last_user_idx is not None:
                    orig = duty_messages[last_user_idx].get("content", "")
                    duty_messages[last_user_idx] = {**duty_messages[last_user_idx],
                                                    "content": orig + duty_ctx + duty_db_ctx}
                answer = call_yandex(SYSTEM_CHAT, duty_messages, max_tokens=1800, fast=True, temperature=0.2)
                print(f"[ROUTER] Запрос о госпошлине → справочник инжектирован, файлы из БД: {bool(duty_db_ctx)}")

            else:
                if _is_simple:
                    answer = call_yandex(SYSTEM_CHAT_SIMPLE, clean_messages, max_tokens=800, fast=True)
                else:
                    answer = call_yandex(SYSTEM_CHAT, clean_messages, max_tokens=2500, fast=True, temperature=0.3)

            # ── Fallback на DeepSeek (Яндекс Cloud) если YandexGPT отказал ──────
            # Не используем для system-режима (внутренние задачи) — там fallback не нужен
            if is_refusal(answer) and not is_system_mode:
                print(f"[ROUTER] YandexGPT отказал → fallback DeepSeek V3")
                ds_raw, ds_cut = call_deepseek(
                    SYSTEM_CHAT_DEEPSEEK,
                    summarized,      # оригинал без очистки ПД
                    max_tokens=1200, # 500 слов × ~1.5 токенов/слово + [РЕЗЮМЕ]
                    temperature=0.3,
                )
                # Убираем строку [РЕЗЮМЕ] из ответа пользователю
                ds_main, ds_summary = _extract_deepseek_summary(ds_raw)
                answer = ds_main if ds_main else ds_raw
                print(f"[ROUTER] DeepSeek ответил, симв={len(answer)}, обрезан={ds_cut}, резюме={'да' if ds_summary else 'нет'}")

                # Если DeepSeek обрезан — помечаем truncated чтобы пользователь мог дочитать
                if ds_cut:
                    truncated = True

                used_deepseek = True
                personal_data_refused = False
            else:
                print(f"[ROUTER] YandexGPT ответил штатно, симв={len(answer)}")

            truncated = len(answer) > 200 and not bool(_RE_TRUNCATED.search(answer.rstrip()))
            _uid, _uemail = _get_user_info()
            threading.Thread(target=log_compute, args=("chat", int((time.time() - _chat_start) * 1000), 2500), kwargs={"user_id": _uid, "user_email": _uemail}, daemon=True).start()
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer, "truncated": truncated, "needs_expert": needs_expert, "personal_data_refused": personal_data_refused}, ensure_ascii=False)}

    except Exception as e:
        if hasattr(e, "response") and e.response is not None:
            code = e.response.status_code
            try:
                detail = e.response.json()
            except Exception:
                detail = e.response.text[:300]
            return {"statusCode": 502, "headers": CORS,
                    "body": json.dumps({"error": f"HTTP {code}: {detail}"}, ensure_ascii=False)}
        return {"statusCode": 500, "headers": CORS, "body": json.dumps({"error": str(e)})}
