"""
AI-чат юриста — только режимы chat и chat_continue.
Таймаут: 35 секунд.
"""
import json
import os
import re
import time
import threading
import requests

# ── Модели Yandex ──────────────────────────────────────────────────────────
YANDEX_MODEL = os.environ.get("YANDEX_MODEL_URI", "gpt://b1gd8kncmd8nf4j7h770/deepseek-v32/latest")
YANDEX_MODEL_FAST = "gpt://b1gd8kncmd8nf4j7h770/yandexgpt/latest"
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
_ANON_IP_LIMIT = 5
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
        timeout=30,
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
)
from state_duty import is_duty_query, get_duty_context_for_chat
from legal_docs_handler import get_legal_context_for_ai

NOTICE_PD = (
    "В связи с политикой обработки данных я не могу использовать "
    "ваши личные реквизиты. После создания документа вы сможете "
    "заполнить их собственноручно.\n\nОднако я проанализирую всё остальное.\n\n"
)


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
        _is_simple = (not _is_case_law) and (not _is_duty) and is_simple_query(messages)

        _t_summary.join(timeout=12)
        summarized = _summary_result[0] if _summary_result else messages
        clean_messages, had_pd = strip_personal_data(summarized)

        needs_expert = False
        personal_data_refused = False
        truncated = False

        if is_system_mode:
            custom_system = messages[0].get("content", SYSTEM_CHAT)
            chat_messages = clean_messages[1:]
            answer = call_yandex(custom_system, chat_messages, max_tokens=1200, fast=True)

        elif _is_case_law:
            _last_user_q = next((m.get("content", "") for m in reversed(clean_messages) if m.get("role") == "user"), "")
            case_law_db_ctx = get_legal_context_for_ai("case_law", max_files=3, max_chars=5000, query=_last_user_q)
            if case_law_db_ctx:
                _case_law_msgs = list(clean_messages)
                _lu_idx = next((i for i in range(len(_case_law_msgs) - 1, -1, -1)
                                if _case_law_msgs[i].get("role") == "user"), None)
                if _lu_idx is not None:
                    _case_law_msgs[_lu_idx] = {**_case_law_msgs[_lu_idx],
                                               "content": _case_law_msgs[_lu_idx].get("content", "") + case_law_db_ctx}
                answer = call_yandex(SYSTEM_CASE_LAW, _case_law_msgs, max_tokens=1400, fast=True, temperature=0.3)
            else:
                answer = call_yandex(SYSTEM_CASE_LAW, clean_messages, max_tokens=1400, fast=True, temperature=0.3)
            if is_case_law_not_found(answer):
                needs_expert = True
                answer = answer.rstrip()
                answer += "\n\n---\nБолее детальный поиск судебной практики по вашему делу может провести наш юрист-эксперт."

        elif _is_duty:
            duty_ctx = get_duty_context_for_chat()
            _last_user_q_duty = next((m.get("content", "") for m in reversed(clean_messages) if m.get("role") == "user"), "")
            duty_db_ctx = get_legal_context_for_ai("state_duty", max_files=2, max_chars=5000, query=_last_user_q_duty)
            duty_messages = list(clean_messages)
            last_user_idx = next((i for i in range(len(duty_messages) - 1, -1, -1)
                                  if duty_messages[i].get("role") == "user"), None)
            if last_user_idx is not None:
                orig = duty_messages[last_user_idx].get("content", "")
                duty_messages[last_user_idx] = {**duty_messages[last_user_idx],
                                                "content": orig + duty_ctx + duty_db_ctx}
            answer = call_yandex(SYSTEM_CHAT, duty_messages, max_tokens=1800, fast=True, temperature=0.2)

        else:
            if _is_simple:
                answer = call_yandex(SYSTEM_CHAT_SIMPLE, clean_messages, max_tokens=800, fast=True)
            else:
                answer = call_yandex(SYSTEM_CHAT, clean_messages, max_tokens=2500, fast=True, temperature=0.3)

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
