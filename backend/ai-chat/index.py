"""
AI-чат юриста — только режимы chat и chat_continue. v2 — расширенный промт с 148 типами документов.
Таймаут: 35 секунд.
"""
import json
import os
import re
import time
import threading
import requests

# ── Модели Yandex ──────────────────────────────────────────────────────────
_FOLDER_ID = os.environ.get("YANDEX_FOLDER_ID", "b1gd8kncmd8nf4j7h770")
YANDEX_MODEL = "gpt://b1gd8kncmd8nf4j7h770/deepseek-v4-flash/latest"
YANDEX_MODEL_FAST = "gpt://b1gd8kncmd8nf4j7h770/deepseek-v4-flash/latest"
_IAM_TOKEN: str = os.environ.get("YANDEX_IAM_TOKEN", "").strip()

_http = requests.Session()
_http.headers.update({"Content-Type": "application/json"})

_RE_TRUNCATED = re.compile(r'[.!?»\d]\s*$')

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

# ── IP rate-limit ───────────────────────────────────────────────────────────
_ANON_IP_CACHE: dict = {}
_ANON_IP_LIMIT = 1
_ANON_IP_WINDOW = 86400
_anon_ip_lock = threading.Lock()

def _check_anon_ip_limit(ip: str) -> bool:
    if not ip:
        return True
    now = time.time()
    with _anon_ip_lock:
        timestamps = _ANON_IP_CACHE.get(ip, [])
        timestamps = [t for t in timestamps if now - t < _ANON_IP_WINDOW]
        if len(timestamps) >= _ANON_IP_LIMIT:
            _ANON_IP_CACHE[ip] = timestamps
            return False
        timestamps.append(now)
        _ANON_IP_CACHE[ip] = timestamps
        if len(_ANON_IP_CACHE) > 10000:
            _ANON_IP_CACHE.clear()
        return True

# ── Персональные данные ─────────────────────────────────────────────────────
_PD_PATTERNS = [
    (re.compile(r'\b\d{3}-\d{3}-\d{3}\s\d{2}\b'), '{{СНИЛС}}'),
    (re.compile(r'\bИНН[:\s]+\d{10,12}\b', re.IGNORECASE), '{{ИНН}}'),
    (re.compile(r'\bОГРН[:\s]+\d{13,15}\b', re.IGNORECASE), '{{ОГРН}}'),
    (re.compile(r'(паспорт|серия паспорта|выдан)[^,;\n]{0,40}\d{4}\s?\d{6}', re.IGNORECASE), '{{ПАСПОРТНЫЕ_ДАННЫЕ}}'),
    (re.compile(r'(?<!\d)\d{4}\s\d{6}(?!\d)'), '{{ПАСПОРТ}}'),
    (re.compile(r'(дата\s+рождения|д\.р\.|дата\sвыдачи|выдан\s+\d)[:\s]*\d{1,2}[./]\d{1,2}[./]\d{2,4}', re.IGNORECASE), '{{ДАТА}}'),
]

def strip_personal_data(messages: list) -> tuple:
    if not messages:
        return messages, False
    cleaned = list(messages)
    for i in range(len(cleaned) - 1, -1, -1):
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

# ── AI-утилиты ──────────────────────────────────────────────────────────────
MAX_HISTORY = 10
SUMMARY_THRESHOLD = 14

REFUSAL_MARKERS = [
    "не могу помочь", "не могу ответить", "не предназначен для",
    "не в состоянии предоставить", "нарушает политику", "не отвечаю на",
    "выходит за рамки", "не могу предоставить информацию",
    "не могу обсуждать", "не могу участвовать",
    "i cannot", "i can't", "i'm unable", "i am unable",
]
SIMPLE_QUERY_MARKERS = [
    "что такое", "как называется", "определение", "понятие", "объясни",
    "расскажи про", "что значит", "какой срок", "какие документы нужны",
    "сколько стоит", "куда обращаться", "какой штраф",
]
_CASE_LAW_MARKERS = [
    "судебная практика", "судебной практике", "судебную практику",
    "аналогичные дела", "похожие дела", "судебные решения",
    "решения судов", "практика судов", "прецедент", "как решают суды",
    "выигрывают ли", "шансы в суде", "примеры из практики",
]
_CASE_LAW_NOT_FOUND_MARKERS = [
    "не могу предоставить", "не могу найти", "нет доступа",
    "не могу осуществить поиск", "нет возможности", "не могу дать конкретные",
    "не обладаю", "у меня нет доступа", "актуальную практику не могу",
    "ограничен в доступе", "к сожалению, не могу", "судебные базы",
]
# Запросы про кодексы и конкретные статьи
_CODEX_MARKERS = [
    "статья ", "ст.", "ст ", "часть ", "пункт ", "п.",
    "гражданский кодекс", "гк рф", "трудовой кодекс", "тк рф",
    "уголовный кодекс", "ук рф", "гражданский процессуальный", "гпк",
    "арбитражный процессуальный", "апк", "налоговый кодекс", "нк рф",
    "административный кодекс", "коап", "жилищный кодекс", "жк рф",
    "семейный кодекс", "ск рф", "земельный кодекс", "зк рф",
    "кодекс об административных", "уголовно-процессуальный", "упк",
]
# Запросы про разъяснения судов
_DEFINITIONS_MARKERS = [
    "постановление пленума", "пленум верховного суда", "пленум вс рф",
    "постановление вс", "обзор практики", "обзор судебной практики",
    "разъяснения суда", "позиция верховного суда", "позиция вс рф",
    "пленум высшего", "постановление пленума вс", "постановление пленума вас",
]

def is_refusal(text) -> bool:
    if not text:
        return False
    low = text.lower()
    return any(m in low for m in REFUSAL_MARKERS)

def is_simple_query(messages: list) -> bool:
    if not messages:
        return False
    last_user = next((m for m in reversed(messages) if m.get("role") == "user"), None)
    if not last_user:
        return False
    text = last_user.get("content", "").lower().strip()
    if len(text) > 120:
        return False
    return any(marker in text for marker in SIMPLE_QUERY_MARKERS)

def is_case_law_query(messages: list) -> bool:
    if not messages:
        return False
    last_user = next((m for m in reversed(messages) if m.get("role") == "user"), None)
    if not last_user:
        return False
    text = last_user.get("content", "").lower()
    return any(marker in text for marker in _CASE_LAW_MARKERS)

def is_codex_query(messages: list) -> bool:
    """Запрос про конкретные статьи кодексов."""
    last_user = next((m for m in reversed(messages) if m.get("role") == "user"), None)
    if not last_user:
        return False
    text = last_user.get("content", "").lower()
    return any(marker in text for marker in _CODEX_MARKERS)

def is_definitions_query(messages: list) -> bool:
    """Запрос про постановления Пленума или разъяснения судов."""
    last_user = next((m for m in reversed(messages) if m.get("role") == "user"), None)
    if not last_user:
        return False
    text = last_user.get("content", "").lower()
    return any(marker in text for marker in _DEFINITIONS_MARKERS)

def is_case_law_not_found(answer) -> bool:
    if not answer:
        return True
    low = answer.lower()
    return any(marker in low for marker in _CASE_LAW_NOT_FOUND_MARKERS)

def call_yandex(system_prompt: str, messages: list, max_tokens: int = 1200, fast: bool = False, temperature: float = 0.3) -> str:
    recent = messages[-MAX_HISTORY:] if len(messages) > MAX_HISTORY else messages
    openai_messages = [{"role": "system", "content": system_prompt}] + [
        {"role": "user" if m.get("role") == "user" else "assistant",
         "content": m.get("content", m.get("text", ""))}
        for m in recent
    ]
    model = YANDEX_MODEL_FAST if fast else YANDEX_MODEL
    resp = _http.post(
        "https://llm.api.cloud.yandex.net/v1/chat/completions",
        headers={"Authorization": f"Api-Key {_IAM_TOKEN}"},
        json={"model": model, "messages": openai_messages, "max_tokens": max_tokens, "temperature": temperature, "stream": False},
        timeout=45,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]

def call_deepseek(system_prompt: str, messages: list, max_tokens: int = 800, temperature: float = 0.3, timeout: int = 30) -> tuple:
    recent = messages[-MAX_HISTORY:] if len(messages) > MAX_HISTORY else messages
    openai_messages = [{"role": "system", "content": system_prompt}] + [
        {"role": "user" if m.get("role") == "user" else "assistant",
         "content": m.get("content", m.get("text", ""))}
        for m in recent
    ]
    resp = _http.post(
        "https://llm.api.cloud.yandex.net/v1/chat/completions",
        headers={"Authorization": f"Api-Key {_IAM_TOKEN}"},
        json={"model": YANDEX_MODEL, "messages": openai_messages, "max_tokens": max_tokens, "temperature": temperature, "stream": False},
        timeout=timeout,
    )
    resp.raise_for_status()
    choice = resp.json()["choices"][0]
    text = choice["message"]["content"] or ""
    was_cut = choice.get("finish_reason") == "length"
    return text, was_cut

def _extract_deepseek_summary(answer: str) -> tuple:
    for marker in ("[РЕЗЮМЕ]:", "[РЕЗЮМЕ]"):
        idx = answer.rfind(marker)
        if idx != -1:
            return answer[:idx].strip(), answer[idx + len(marker):].strip()
    return answer.strip(), ""

def summarize_old_messages(messages: list) -> list:
    if len(messages) <= SUMMARY_THRESHOLD:
        return messages
    tail = messages[-MAX_HISTORY:]
    head = messages[:-MAX_HISTORY]
    dialog_text = "\n".join(
        f"{'Пользователь' if m.get('role') == 'user' else 'Юрист'}: {m.get('content', '')[:400]}"
        for m in head
    )
    summary_prompt = (
        "Сожми диалог в краткое резюме (3-5 предложений): "
        "кто обратился, суть правовой ситуации, ключевые факты. "
        "Только факты, без рекомендаций.\n\n" + dialog_text
    )
    try:
        resp = _http.post(
            "https://llm.api.cloud.yandex.net/v1/chat/completions",
            headers={"Authorization": f"Api-Key {_IAM_TOKEN}"},
            json={"model": YANDEX_MODEL_FAST, "messages": [{"role": "user", "content": summary_prompt}],
                  "max_tokens": 300, "temperature": 0.2, "stream": False},
            timeout=12,
        )
        resp.raise_for_status()
        summary = resp.json()["choices"][0]["message"]["content"].strip()
        return [{"role": "user", "content": f"[Контекст предыдущего диалога: {summary}]"}] + tail
    except Exception:
        return tail

# ── Промпты (инлайн, чтобы не зависеть от файла prompts.py) ─────────────────
from prompts import (
    SYSTEM_CHAT, SYSTEM_CHAT_SIMPLE, SYSTEM_CASE_LAW, SYSTEM_CHAT_DEEPSEEK,
    SYSTEM_CHAT_LANDING_STEP1, SYSTEM_CHAT_LANDING_STEP2,
)
from state_duty import is_duty_query, get_duty_context_for_chat
from legal_docs_handler import get_legal_context_for_ai

NOTICE_PD = (
    "В связи с политикой обработки данных я не могу использовать "
    "ваши личные реквизиты. После создания документа вы сможете "
    "заполнить их собственноручно.\n\nОднако я проанализирую всё остальное.\n\n"
)


def detectDocSuggestionPy(text: str) -> str | None:
    lo = text.lower()
    # Претензии — в приоритете над «договором»
    if "претензи" in lo and "потребит" in lo: return "pretension_consumer"
    if "претензи" in lo and ("подрядчик" in lo or "исполнител" in lo or "поставщик" in lo): return "pretension_contract"
    if "претензи" in lo and "договор" in lo: return "pretension_contract"
    if "претензи" in lo: return "pretension"
    if "досудебн" in lo and ("требовани" in lo or "уведомлени" in lo or "претензи" in lo): return "pretension"
    # Иски
    if "взыскани" in lo and ("долг" in lo or "задолженн" in lo): return "claim_debt"
    if "расторжени" in lo and "брак" in lo: return "claim_divorce"
    if "алимент" in lo: return "claim_alimony"
    if "потребит" in lo and "защит" in lo: return "claim_consumer"
    if "возмещени" in lo and "ущерб" in lo: return "claim_damage"
    if "затоплени" in lo or ("сосед" in lo and "ущерб" in lo): return "claim_damage"
    if "апелляц" in lo: return "appeal"
    if "кассаци" in lo: return "cassation"
    if "уведомлени" in lo and "расторжени" in lo: return "notification_termination"
    if "ходатайств" in lo: return "petition_evidence"
    if "возражени" in lo: return "response_to_claim"
    # Договоры
    if "трудов" in lo and "договор" in lo: return "labor_contract"
    if "договор" in lo and "аренд" in lo: return "contract_rent"
    if "договор" in lo and "купл" in lo: return "contract_sale"
    if "договор" in lo and "займ" in lo: return "contract_loan"
    if "договор" in lo and "услуг" in lo: return "contract_services"
    if "договор" in lo and "подряд" in lo: return "contract_work"
    if "расписк" in lo: return "contract_receipt"
    if "договор" in lo: return "contract"
    # Госорганы
    if "прокуратур" in lo: return "gov_prosecutor"
    if "роспотребнадзор" in lo: return "gov_rospotreb"
    if "полици" in lo or "мошенничеств" in lo: return "gov_police"
    if "трудов" in lo and "инспекц" in lo: return "gov_labor_insp"
    if "увольнени" in lo: return "labor_quit_app"
    if "приказ" in lo: return "labor_order_discipline"
    if "жалоб" in lo: return "complaint"
    if "исков" in lo or "иск" in lo: return "claim"
    if "заявлени" in lo: return "application"
    return None


def handler(event: dict, context) -> dict:
    """AI-чат юриста: консультации, судебная практика, госпошлина. Таймаут 35с."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    if event.get("httpMethod") == "GET":
        return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"ok": True, "service": "ai-chat"})}

    headers = event.get("headers") or {}
    token = headers.get("X-Auth-Token") or headers.get("x-auth-token", "")
    ip = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp", "")

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    mode = body.get("mode", "chat")

    try:
        # ── Лендинг-чат (сбор данных для документа) ─────────────────────────
        if mode == "landing_chat":
            messages = body.get("messages", [])
            step = int(body.get("step", 1))
            if not messages:
                return {"statusCode": 400, "headers": CORS,
                        "body": json.dumps({"error": "messages required"})}
            clean_messages, _ = strip_personal_data(messages[-6:])
            system_prompt = SYSTEM_CHAT_LANDING_STEP2 if step >= 2 else SYSTEM_CHAT_LANDING_STEP1
            max_tokens = 800 if step >= 2 else 1200
            answer, _ = call_deepseek(system_prompt, clean_messages, max_tokens=max_tokens, temperature=0.15, timeout=30)
            suggest = detectDocSuggestionPy("\n".join(m.get("content","") for m in clean_messages) + "\n" + answer)
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer, "suggest_doc_type": suggest}, ensure_ascii=False)}

        # ── Продолжение обрезанного ответа ──────────────────────────────────
        if mode == "chat_continue":
            messages = body.get("messages", [])
            partial = body.get("partial", "").strip()
            if not partial:
                return {"statusCode": 400, "headers": CORS,
                        "body": json.dumps({"error": "partial required"})}
            cont_messages = list(messages) + [
                {"role": "assistant", "content": partial},
                {"role": "user", "content": "Продолжи ответ с того места, где остановился. Не повторяй уже написанное."},
            ]
            answer = call_yandex(SYSTEM_CHAT, cont_messages, max_tokens=1200, fast=True)
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer}, ensure_ascii=False)}

        # ── Обычный чат-консультация ─────────────────────────────────────────
        _chat_start = time.time()
        messages = body.get("messages", [])
        if not messages:
            return {"statusCode": 400, "headers": CORS,
                    "body": json.dumps({"error": "messages required"})}

        # IP rate-limit для анонимного чата
        if not token and ip:
            if not _check_anon_ip_limit(ip):
                return {"statusCode": 429, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "Лимит бесплатных вопросов исчерпан. Зарегистрируйтесь для продолжения.",
                                            "limit_reached": True}, ensure_ascii=False)}

        # Анонимам — только последние 6 сообщений
        if not token:
            messages = messages[-6:]

        is_system_mode = messages and messages[0].get("role") == "system"

        # Параллельно: сжатие истории + определение маршрута
        _summary_result: list = []
        def _run_summary():
            _summary_result.append(summarize_old_messages(messages))
        _t_summary = threading.Thread(target=_run_summary, daemon=True)
        _t_summary.start()

        _is_case_law = is_case_law_query(messages)
        _is_duty = (not _is_case_law) and is_duty_query(messages)
        _is_codex = is_codex_query(messages)
        _is_definitions = is_definitions_query(messages)
        _is_simple = (not _is_case_law) and (not _is_duty) and (not _is_codex) and (not _is_definitions) and is_simple_query(messages)

        _t_summary.join(timeout=12)
        summarized = _summary_result[0] if _summary_result else messages
        clean_messages, had_pd = strip_personal_data(summarized)

        _last_user_q = next((m.get("content", "") for m in reversed(clean_messages) if m.get("role") == "user"), "")

        needs_expert = False
        personal_data_refused = False
        truncated = False

        if is_system_mode:
            custom_system = messages[0].get("content", SYSTEM_CHAT)
            chat_messages = clean_messages[1:]
            answer = call_yandex(custom_system, chat_messages, max_tokens=2000, fast=True)

        elif _is_case_law:
            case_law_db_ctx = get_legal_context_for_ai("case_law", max_files=3, max_chars=5000, query=_last_user_q)
            if case_law_db_ctx:
                _case_law_msgs = list(clean_messages)
                _lu_idx = next((i for i in range(len(_case_law_msgs) - 1, -1, -1)
                                if _case_law_msgs[i].get("role") == "user"), None)
                if _lu_idx is not None:
                    _case_law_msgs[_lu_idx] = {**_case_law_msgs[_lu_idx],
                                               "content": _case_law_msgs[_lu_idx].get("content", "") + case_law_db_ctx}
                answer = call_yandex(SYSTEM_CASE_LAW, _case_law_msgs, max_tokens=3000, fast=True, temperature=0.3)
            else:
                answer = call_yandex(SYSTEM_CASE_LAW, clean_messages, max_tokens=3000, fast=True, temperature=0.3)
            if is_case_law_not_found(answer):
                needs_expert = True
                answer = answer.rstrip()
                answer += "\n\n---\nБолее детальный поиск судебной практики по вашему делу может провести наш юрист-эксперт."

        elif _is_duty:
            duty_ctx = get_duty_context_for_chat()
            duty_db_ctx = get_legal_context_for_ai("state_duty", max_files=2, max_chars=5000, query=_last_user_q)
            duty_messages = list(clean_messages)
            last_user_idx = next((i for i in range(len(duty_messages) - 1, -1, -1)
                                  if duty_messages[i].get("role") == "user"), None)
            if last_user_idx is not None:
                orig = duty_messages[last_user_idx].get("content", "")
                duty_messages[last_user_idx] = {**duty_messages[last_user_idx],
                                                "content": orig + duty_ctx + duty_db_ctx}
            answer = call_yandex(SYSTEM_CHAT, duty_messages, max_tokens=3000, fast=True, temperature=0.2)

        else:
            # Параллельно ищем по всем категориям правовой базы
            _extra_ctx_parts: list = []
            _codex_result: list = []
            _def_result: list = []
            _case_law_result: list = []
            _duty_result2: list = []

            def _fetch_codex():
                ctx = get_legal_context_for_ai("codex", max_files=3, max_chars=3000, query=_last_user_q)
                if ctx: _codex_result.append(ctx)
            def _fetch_def():
                ctx = get_legal_context_for_ai("court_definitions", max_files=2, max_chars=3000, query=_last_user_q)
                if ctx: _def_result.append(ctx)
            def _fetch_case_law():
                if not _is_simple:
                    ctx = get_legal_context_for_ai("case_law", max_files=2, max_chars=2500, query=_last_user_q)
                    if ctx: _case_law_result.append(ctx)
            def _fetch_duty2():
                if not _is_simple:
                    ctx = get_legal_context_for_ai("state_duty", max_files=1, max_chars=1500, query=_last_user_q)
                    if ctx: _duty_result2.append(ctx)

            _t_codex = threading.Thread(target=_fetch_codex, daemon=True)
            _t_def = threading.Thread(target=_fetch_def, daemon=True)
            _t_case = threading.Thread(target=_fetch_case_law, daemon=True)
            _t_duty2 = threading.Thread(target=_fetch_duty2, daemon=True)
            for _t in (_t_codex, _t_def, _t_case, _t_duty2):
                _t.start()
            for _t in (_t_codex, _t_def, _t_case, _t_duty2):
                _t.join(timeout=6)

            if _codex_result: _extra_ctx_parts.append(_codex_result[0])
            if _def_result: _extra_ctx_parts.append(_def_result[0])
            if _case_law_result: _extra_ctx_parts.append(_case_law_result[0])
            if _duty_result2: _extra_ctx_parts.append(_duty_result2[0])

            if _extra_ctx_parts:
                extra_ctx = "".join(_extra_ctx_parts)
                enriched_msgs = list(clean_messages)
                _lu_idx2 = next((i for i in range(len(enriched_msgs) - 1, -1, -1)
                                 if enriched_msgs[i].get("role") == "user"), None)
                if _lu_idx2 is not None:
                    enriched_msgs[_lu_idx2] = {**enriched_msgs[_lu_idx2],
                                               "content": enriched_msgs[_lu_idx2].get("content", "") + extra_ctx}
                answer = call_yandex(SYSTEM_CHAT, enriched_msgs, max_tokens=3000, fast=True, temperature=0.2)
                print(f"[AI_CHAT] universal_ctx: chars={len(extra_ctx)}, simple={_is_simple}")
            elif _is_simple:
                answer = call_yandex(SYSTEM_CHAT_SIMPLE, clean_messages, max_tokens=800, fast=True)
            else:
                answer = call_yandex(SYSTEM_CHAT, clean_messages, max_tokens=3000, fast=True, temperature=0.3)

        # Fallback DeepSeek при отказе Яндекса
        if is_refusal(answer) and not is_system_mode:
            ds_raw, ds_cut = call_deepseek(SYSTEM_CHAT_DEEPSEEK, summarized, max_tokens=1200, temperature=0.3)
            ds_main, _ = _extract_deepseek_summary(ds_raw)
            answer = ds_main if ds_main else ds_raw
            if ds_cut:
                truncated = True
            personal_data_refused = False

        truncated = truncated or (len(answer) > 200 and not bool(_RE_TRUNCATED.search(answer.rstrip())))

        return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"answer": answer, "truncated": truncated,
                                    "needs_expert": needs_expert,
                                    "personal_data_refused": personal_data_refused}, ensure_ascii=False)}

    except Exception as e:
        if hasattr(e, "response") and e.response is not None:
            code = e.response.status_code
            try:
                detail = e.response.json()
            except Exception:
                detail = e.response.text[:300]
            return {"statusCode": 502, "headers": CORS,
                    "body": json.dumps({"error": f"HTTP {code}: {detail}"}, ensure_ascii=False)}
        return {"statusCode": 500, "headers": CORS,
                "body": json.dumps({"error": str(e)})}