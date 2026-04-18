"""
Единый API: AI-юрист (DeepSeek V3 via Yandex Cloud) + авторизация. v4 — prompts extracted.
mode: "chat" | "doc_generate" | "file_analyze" | "file_cleanup"
auth actions: register, login, me, logout, update-profile, consume-question, add-paid-service
"""
import json
import os
import re
import warnings
import requests
import base64
import io
import time
import threading

from auth_handler import (
    handle_register, handle_login, handle_me,
    handle_logout, handle_update_profile,
    handle_consume_question, handle_consume_doc, handle_add_paid_service,
    handle_report, handle_send_otp, handle_verify_otp, sanitize_str,
    handle_lawyer_send, handle_lawyer_messages,
    handle_admin_reports, handle_my_reports,
    handle_business_update_org, handle_business_consume_action,
    handle_business_messages_get, handle_business_messages_save,
    handle_get_billing_log, handle_list_users,
    handle_get_all_billing_log, handle_get_new_users,
    handle_admin_grant,
)
from prompts import (
    TODAY, SYSTEM_CHAT, SYSTEM_CHAT_SIMPLE, SYSTEM_DOC_GENERATE, SYSTEM_FILE_ANALYZE_PROMPT,
    SYSTEM_FILE_QA_PROMPT,
    SYSTEM_DOC_BY_TYPE, DOC_STARTERS, REFUSAL_MARKERS, SIMPLE_QUERY_MARKERS,
    SYSTEM_BUSINESS_CHAT, SYSTEM_BUSINESS_CONTRACT,
    SYSTEM_COUNTERPARTY_CHECK, SYSTEM_TAX_ANALYSIS,
    SYSTEM_CASE_LAW, SYSTEM_CHAT_DEEPSEEK, SYSTEM_DEEPSEEK_SUMMARY_RELAY,
)

# Типы документов, для которых ораторский финал (не "подпись/реквизиты")
SPEECH_DOC_TYPES = {"court_speech"}

warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=UserWarning)

YANDEX_MODEL = os.environ.get("YANDEX_MODEL_URI", "gpt://b1gd8kncmd8nf4j7h770/deepseek-v32/latest")
# Быстрая модель для консультаций
YANDEX_MODEL_FAST = "gpt://b1gd8kncmd8nf4j7h770/yandexgpt/latest"

# ───────────────────────────────────────────────
# S3 и файловые утилиты
# ───────────────────────────────────────────────
FILE_TTL = 1800
FILE_BUCKET = "files"
FILE_PREFIX = "temp-docs/"
MAX_FILE_MB = 10
ALLOWED_EXTS = {"pdf", "docx", "doc", "jpeg", "jpg", "png"}


def get_s3():
    import boto3
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def save_temp_file(s3, data: bytes, filename: str, content_type: str) -> str:
    ts = int(time.time())
    key = f"{FILE_PREFIX}{ts}_{filename}"
    s3.put_object(Bucket=FILE_BUCKET, Key=key, Body=data, ContentType=content_type,
                  Metadata={"uploaded_at": str(ts)})
    return key


def cleanup_temp_files(s3) -> list:
    deleted = []
    now = int(time.time())
    try:
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=FILE_BUCKET, Prefix=FILE_PREFIX):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                basename = key.replace(FILE_PREFIX, "")
                parts = basename.split("_", 1)
                try:
                    uploaded_at = int(parts[0])
                    if now - uploaded_at >= FILE_TTL:
                        s3.delete_object(Bucket=FILE_BUCKET, Key=key)
                        deleted.append(key)
                except (ValueError, IndexError):
                    pass
    except Exception:
        pass
    return deleted


def extract_pdf_text(data: bytes) -> str:
    import PyPDF2
    reader = PyPDF2.PdfReader(io.BytesIO(data))
    pages = [p.extract_text() or "" for p in reader.pages[:20]]
    return "\n".join(pages).strip()


def extract_docx_text(data: bytes) -> str:
    from docx import Document as DocxDocument
    doc = DocxDocument(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())[:12000]


def _compress_image(image_data: bytes, max_bytes: int = 900_000) -> bytes:
    if len(image_data) <= max_bytes:
        return image_data
    try:
        from PIL import Image as PILImage
        img = PILImage.open(io.BytesIO(image_data))
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        max_side = 2000
        w, h = img.size
        if max(w, h) > max_side:
            ratio = max_side / max(w, h)
            img = img.resize((int(w * ratio), int(h * ratio)), PILImage.LANCZOS)
        buf = io.BytesIO()
        quality = 85
        while quality >= 40:
            buf.seek(0)
            buf.truncate()
            img.save(buf, format="JPEG", quality=quality, optimize=True)
            if buf.tell() <= max_bytes:
                break
            quality -= 15
        return buf.getvalue()
    except Exception:
        return image_data[:max_bytes]


def extract_image_text_ocr(image_data: bytes, ext: str) -> str:
    iam_token = os.environ.get("YANDEX_IAM_TOKEN", "").strip()
    if not iam_token:
        return ""

    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}
    mime_type = mime_map.get(ext, "image/jpeg")
    compressed = _compress_image(image_data)
    b64_image = base64.b64encode(compressed).decode("utf-8")

    try:
        resp = requests.post(
            "https://vision.api.cloud.yandex.net/vision/v1/batchAnalyze",
            headers={"Authorization": f"Api-Key {iam_token}", "Content-Type": "application/json"},
            json={
                "analyzeSpecs": [{
                    "content": b64_image,
                    "features": [{"type": "TEXT_DETECTION", "textDetectionConfig": {"languageCodes": ["ru", "en"]}}],
                    "mimeType": mime_type,
                }]
            },
            timeout=12,
        )
        if not resp.ok:
            return ""
        result = resp.json()
        blocks = (result.get("results", [{}])[0]
                  .get("results", [{}])[0]
                  .get("textDetection", {})
                  .get("pages", []))
        lines = []
        for page in blocks:
            for block in page.get("blocks", []):
                for line in block.get("lines", []):
                    words = [w.get("text", "") for w in line.get("words", [])]
                    if words:
                        lines.append(" ".join(words))
        return "\n".join(lines).strip()
    except Exception:
        return ""


def _call_openai_compat(messages: list, max_tokens: int, temperature: float = 0.3) -> str:
    iam_token = os.environ["YANDEX_IAM_TOKEN"].strip()
    resp = requests.post(
        "https://llm.api.cloud.yandex.net/v1/chat/completions",
        headers={"Authorization": f"Api-Key {iam_token}", "Content-Type": "application/json"},
        json={
            "model": YANDEX_MODEL,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        },
        timeout=180,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def call_deepseek(system_prompt: str, messages: list, max_tokens: int = 1200, temperature: float = 0.3) -> str:
    """DeepSeek V3 через Яндекс Cloud — fallback при отказе YandexGPT из-за персональных данных."""
    recent = messages[-MAX_HISTORY:] if len(messages) > MAX_HISTORY else messages
    openai_messages = [{"role": "system", "content": system_prompt}] + [
        {
            "role": "user" if m.get("role") == "user" else "assistant",
            "content": m.get("content", m.get("text", "")),
        }
        for m in recent
    ]
    return _call_openai_compat(openai_messages, max_tokens, temperature=temperature)


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


def analyze_file_with_yandex(text: str, comment: str, iam_token: str) -> str:
    if comment:
        # Режим QA: пользователь задал конкретный вопрос — отвечаем на него с документом как контекстом
        system_prompt = SYSTEM_FILE_QA_PROMPT
        user_content = f"Вопрос пользователя: {comment}\n\nТекст документа:\n\n{text[:8000]}"
    else:
        # Режим анализа: общий юридический разбор документа
        system_prompt = SYSTEM_FILE_ANALYZE_PROMPT
        user_content = f"Документ:\n\n{text[:8000]}"
    return _call_openai_compat(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        max_tokens=2500,
        temperature=0.2,
    )


CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}


def is_refusal(text: str) -> bool:
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
        iam_token = os.environ["YANDEX_IAM_TOKEN"].strip()
        resp = requests.post(
            "https://llm.api.cloud.yandex.net/v1/chat/completions",
            headers={"Authorization": f"Api-Key {iam_token}", "Content-Type": "application/json"},
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

def is_case_law_not_found(answer: str) -> bool:
    """Определяет, не смог ли AI найти судебную практику."""
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
        iam_token = os.environ["YANDEX_IAM_TOKEN"].strip()
        resp = requests.post(
            "https://llm.api.cloud.yandex.net/v1/chat/completions",
            headers={"Authorization": f"Api-Key {iam_token}", "Content-Type": "application/json"},
            json={"model": YANDEX_MODEL_FAST, "messages": openai_messages, "max_tokens": max_tokens, "temperature": temperature, "stream": False},
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    return _call_openai_compat(openai_messages, max_tokens, temperature=temperature)


def handler(event: dict, context) -> dict:
    """AI-юрист (DeepSeek V3) + авторизация. Режимы: chat, doc_chat, doc_generate."""
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

    auth_actions = {
        "register": lambda: handle_register(body),
        "login": lambda: handle_login(body, ip),
        "me": lambda: handle_me(token),
        "logout": lambda: handle_logout(token),
        "update-profile": lambda: handle_update_profile(token, body),
        "consume-question": lambda: handle_consume_question(token),
        "consume-doc": lambda: handle_consume_doc(token),
        "add-paid-service": lambda: handle_add_paid_service(token, body),
        "report": lambda: handle_report(token, body),
        "my-reports": lambda: handle_my_reports(token),
        "admin-reports": lambda: handle_admin_reports(token, body),
        "send-otp": lambda: handle_send_otp(body),
        "verify-otp": lambda: handle_verify_otp(body),
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
            file_b64 = body.get("file", "")
            filename = body.get("filename", "")
            if not details:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "details required"})}
            doc_labels = {
                "claim": "исковое заявление",
                "pretension": "досудебную претензию",
                "complaint": "жалобу",
                "application": "заявление/ходатайство",
                "notification": "уведомление",
                "order": "приказ",
                "contract": "договор ГПХ",
                "business_contract": "коммерческий договор",
                "court_speech": "судебную речь",
                "response_to_claim": "отзыв на исковое заявление",
                "objection": "возражение",
                "appeal": "апелляционную жалобу",
                "cassation": "кассационную жалобу",
                "supervisory": "надзорную жалобу",
            }
            label = doc_labels.get(doc_type, "документ")
            system_prompt = SYSTEM_DOC_BY_TYPE.get(doc_type, SYSTEM_DOC_GENERATE)

            # Извлекаем текст из загруженного файла если есть
            file_context = ""
            if file_b64 and filename:
                try:
                    file_data = base64.b64decode(file_b64)
                    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
                    if ext == "pdf":
                        file_context = extract_pdf_text(file_data)[:4000]
                    elif ext in ("docx", "doc"):
                        file_context = extract_docx_text(file_data)[:4000]
                    elif ext in ("jpg", "jpeg", "png"):
                        file_context = extract_image_text_ocr(file_data, ext)[:3000]
                except Exception:
                    file_context = ""

            chat_history = body.get("chat_history", [])
            history_context = ""
            if chat_history:
                last_pairs = chat_history[-10:]
                # Извлекаем факты из диалога структурированно
                user_msgs = [m.get("content", "") for m in last_pairs if m.get("role") == "user"]
                ai_msgs = [m.get("content", "") for m in last_pairs if m.get("role") != "user"]
                history_context = (
                    "КОНТЕКСТ ИЗ ПРЕДЫДУЩЕЙ КОНСУЛЬТАЦИИ (используй все упомянутые факты, стороны, суммы, даты):\n"
                )
                for msg in last_pairs:
                    role_label = "Пользователь" if msg.get("role") == "user" else "Юрист"
                    content = msg.get("content", "")[:800]
                    history_context += f"{role_label}: {content}\n"
                history_context += "\nВАЖНО: подстави все конкретные данные из диалога (ФИО, суммы, даты, адреса) напрямую в документ.\n\n"
            # Специальный промпт для судебной речи
            speech_style = ""
            if doc_type in SPEECH_DOC_TYPES:
                speech_style = (
                    "ОРАТОРСКИЙ СТИЛЬ (обязательно): короткие предложения (7–12 слов), паузы (//), "
                    "тройные перечисления, сильные глаголы, один тезис на абзац. "
                    "Ключевую мысль — в начало и в конец. Без воды и длинных оборотов.\n\n"
                    "ОФОРМЛЕНИЕ: шрифт Times New Roman 14 (заголовки 16), межстрочный интервал 1,5, "
                    "поля: левое 3 см, правое 1,5 см, верх/низ 2 см, абзацный отступ 1,25 см. "
                    "Заголовки блоков — жирный. Ключевые тезисы — **полужирный** или _курсив_. "
                    "Ссылки на доказательства: (т. 1, л.д. 15). Нумерация страниц — внизу по центру.\n\n"
                )
            prompt = (
                history_context
                + speech_style
                + f"Составь {label} на основании следующего описания ситуации:\n\n{details}\n\n"
                + (f"Дополнительные материалы из загруженного файла ({filename}):\n{file_context}\n\n" if file_context else "")
                + f"Там где не хватает конкретных данных (ФИО, адрес, номер дела и т.д.) — "
                f"используй метки-заглушки {{{{ПОЛЕ_НАЗВАНИЕ}}}} (русский язык, подчёркивание). "
                f"Запрещены [...] и ___."
            )
            answer = call_yandex(system_prompt, [{"role": "user", "content": prompt}], max_tokens=3500, temperature=0.15)
            # Для речи завершённость определяем по финальному обращению к суду
            if doc_type in SPEECH_DOC_TYPES:
                truncated = not bool(re.search(r'(прошу\s+суд|прошу\s+уважаемый|на\s+основании\s+изложенного|итог|в\s+заключение)', answer[-400:], re.I))
            else:
                truncated = not bool(re.search(r'(подпись|реквизиты|экземпляр|дата\s*[:|]?\s*«|\d{1,2}\.\d{2}\.\d{4})', answer[-300:], re.I))
            placeholders = list(dict.fromkeys(re.findall(r'\{\{([^}]+)\}\}', answer)))
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer, "placeholders": placeholders, "truncated": truncated}, ensure_ascii=False)}

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

        # ── Анализ загруженного файла ──
        elif mode == "file_analyze":
            file_b64 = body.get("file", "")
            filename = body.get("filename", "document")
            comment = body.get("comment", "").strip()

            if not file_b64:
                return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "file required"}, ensure_ascii=False)}

            file_data = base64.b64decode(file_b64)
            if len(file_data) > MAX_FILE_MB * 1024 * 1024:
                return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": f"Файл слишком большой. Максимум {MAX_FILE_MB} МБ."}, ensure_ascii=False)}

            ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            if ext not in ALLOWED_EXTS:
                return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": f"Формат .{ext} не поддерживается. Допустимые: PDF, DOCX, DOC, JPEG, JPG, PNG."}, ensure_ascii=False)}

            mime_map = {"pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "doc": "application/msword", "jpeg": "image/jpeg", "jpg": "image/jpeg", "png": "image/png"}
            content_type = mime_map.get(ext, "application/octet-stream")
            def _bg_upload():
                try:
                    s3 = get_s3()
                    save_temp_file(s3, file_data, filename, content_type)
                    cleanup_temp_files(s3)
                except Exception:
                    pass
            threading.Thread(target=_bg_upload, daemon=True).start()

            is_image_file = ext in ("jpg", "jpeg", "png")
            ocr_failed = False
            ocr_b64 = None

            if ext == "pdf":
                text = extract_pdf_text(file_data)
            elif ext in ("docx", "doc"):
                text = extract_docx_text(file_data)
            else:
                compressed = _compress_image(file_data, max_bytes=700_000)
                ocr_b64 = base64.b64encode(compressed).decode("utf-8")
                text = extract_image_text_ocr(compressed, ext)
                if not text or len(text.strip()) < 15:
                    ocr_failed = True
                    text = ""

            iam_token = os.environ["YANDEX_IAM_TOKEN"].strip()

            if ocr_failed and ocr_b64:
                try:
                    user_msg_content = [
                        {"type": "text", "text": (
                            "Ты — опытный юрист РФ. Пользователь загрузил фото документа.\n\n"
                            + (
                                f"Вопрос пользователя: {comment}\n\n"
                                "Отвечай СТРОГО на этот вопрос, используя содержимое документа на фото как источник фактов. "
                                "Не делай общий анализ — только ответ на вопрос со ссылками на статьи законов РФ."
                                if comment else
                                "СТРОГО ЗАПРЕЩЕНО: пересказывать текст документа.\n\n"
                                "Дай краткое практическое юридическое заключение:\n"
                                "**Тип и суть** — одной фразой что это за документ.\n"
                                "**Правовые риски** — с указанием статьи закона РФ, приоритет: 🔴 критично / 🟡 существенно / 🟢 незначительно.\n"
                                "**Что делать** — 1–3 практических шага."
                            )
                            + "\n\nЕсли фото нечёткое — скажи об этом и проанализируй видимое."
                        )},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{ocr_b64}"}},
                    ]
                    vision_resp = requests.post(
                        "https://llm.api.cloud.yandex.net/v1/chat/completions",
                        headers={"Authorization": f"Api-Key {iam_token}", "Content-Type": "application/json"},
                        json={
                            "model": "gpt://b1g2k5n3ojr7ik7lv73l/yandexgpt-vision-lite/latest",
                            "messages": [{"role": "user", "content": user_msg_content}],
                            "max_tokens": 2000,
                            "temperature": 0.1,
                        },
                        timeout=30,
                    )
                    if vision_resp.ok:
                        answer = vision_resp.json()["choices"][0]["message"]["content"]
                        return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                                "body": json.dumps({"answer": answer, "filename": filename,
                                                    "delete_at": int(time.time()) + FILE_TTL}, ensure_ascii=False)}
                except Exception:
                    pass

            if not text or len(text.strip()) < 20:
                return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "Не удалось извлечь текст из файла. Попробуйте PDF или DOCX."}, ensure_ascii=False)}

            # Параллельно: анализ документа + генерация подсказки для создания документа
            analysis_result = [None]
            hint_result = [None]

            def _do_analysis():
                analysis_result[0] = analyze_file_with_yandex(text, comment, iam_token)

            def _do_hint():
                doc_types_list = "claim — исковое заявление, pretension — досудебная претензия, complaint — жалоба, application — заявление/ходатайство, notification — уведомление, order — приказ, contract — договор ГПХ, business_contract — коммерческий договор, court_speech — судебная речь, response_to_claim — отзыв на исковое заявление, objection — возражение, appeal — апелляционная жалоба, cassation — кассационная жалоба, supervisory — надзорная жалоба"
                if comment:
                    # Пользователь явно указал что нужно — это приоритет
                    hint_prompt = (
                        f"Ты — помощник юриста. Пользователь загрузил документ и ЯВНО УКАЗАЛ какой документ нужно составить.\n\n"
                        f"ЗАПРОС ПОЛЬЗОВАТЕЛЯ (ПРИОРИТЕТ): {comment}\n\n"
                        f"Доступные типы документов: {doc_types_list}\n\n"
                        f"Текст загруженного документа (используй как источник фактов):\n{text[:5000]}\n\n"
                        f"Определи doc_type строго по запросу пользователя. Извлеки из документа все факты: стороны, суммы, даты, адреса, номера дел.\n"
                        f"Ответь СТРОГО в JSON без пояснений:\n"
                        f'{{\"doc_type\": \"id_типа\", \"details\": \"подробное описание ситуации и всех фактов для составления документа\", \"doc_label\": \"название документа на русском\"}}'
                    )
                else:
                    # Нет запроса — определяем ответный документ сами
                    hint_prompt = (
                        f"Ты — помощник юриста. Изучи текст документа и определи какой ответный или связанный документ нужно составить.\n"
                        f"Извлеки из документа все известные факты: стороны (ФИО, организации), суммы, даты, адреса, суть спора, реквизиты дела.\n\n"
                        f"Доступные типы документов: {doc_types_list}\n\n"
                        f"Текст документа:\n{text[:5000]}\n\n"
                        f"Ответь СТРОГО в JSON без пояснений:\n"
                        f'{{\"doc_type\": \"id_типа\", \"details\": \"подробное описание ситуации и всех фактов для составления документа\", \"doc_label\": \"название документа на русском\"}}'
                    )
                try:
                    resp = requests.post(
                        "https://llm.api.cloud.yandex.net/v1/chat/completions",
                        headers={"Authorization": f"Api-Key {iam_token}", "Content-Type": "application/json"},
                        json={
                            "model": YANDEX_MODEL_FAST,
                            "messages": [{"role": "user", "content": hint_prompt}],
                            "max_tokens": 800,
                            "temperature": 0.1,
                            "stream": False,
                        },
                        timeout=30,
                    )
                    resp.raise_for_status()
                    raw = resp.json()["choices"][0]["message"]["content"]
                    import re as _re
                    match = _re.search(r'\{[\s\S]*\}', raw)
                    if match:
                        hint_result[0] = json.loads(match.group())
                except Exception:
                    pass

            t_analysis = threading.Thread(target=_do_analysis)
            t_hint = threading.Thread(target=_do_hint)
            t_analysis.start()
            t_hint.start()
            t_analysis.join()
            t_hint.join()

            answer = analysis_result[0] or "Не удалось проанализировать документ."

            response_data = {
                "answer": answer,
                "filename": filename,
                "delete_at": int(time.time()) + FILE_TTL,
                "extracted_text": text[:6000],
            }
            if hint_result[0]:
                response_data["doc_hint"] = hint_result[0]

            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps(response_data, ensure_ascii=False)}

        # ── Бизнес-чат ──
        elif mode == "business_chat":
            biz_messages = body.get("messages", [])
            org_name = body.get("org_name", "").strip()
            biz_mode = body.get("biz_mode", "chat")
            if not biz_messages:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "messages required"})}

            # Извлекаем текст из файлов
            file_texts = []
            for fkey, fnkey in [("file", "filename"), ("file2", "filename2")]:
                fb64 = body.get(fkey, "")
                fname = body.get(fnkey, "")
                if fb64 and fname:
                    try:
                        fdata = base64.b64decode(fb64)
                        ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
                        if ext == "pdf":
                            file_texts.append(f"[Файл: {fname}]\n{extract_pdf_text(fdata)[:5000]}")
                        elif ext in ("docx", "doc"):
                            file_texts.append(f"[Файл: {fname}]\n{extract_docx_text(fdata)[:5000]}")
                        elif ext in ("jpg", "jpeg", "png"):
                            txt = extract_image_text_ocr(fdata, ext)
                            if txt:
                                file_texts.append(f"[Файл: {fname}]\n{txt[:3000]}")
                    except Exception:
                        pass

            # Добавляем текст файлов к последнему сообщению пользователя
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

            if is_doc_mode:
                trimmed = biz_messages
                answer = call_yandex(sys_prompt, trimmed, max_tokens=3500, fast=False, temperature=0.15)
            elif is_case_law_query(biz_messages):
                summarized_biz = summarize_old_messages(biz_messages)
                trimmed, had_pd = strip_personal_data(summarized_biz)
                answer = call_yandex(SYSTEM_CASE_LAW, trimmed, max_tokens=1400, fast=True, temperature=0.3)
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
                answer = call_yandex(sys_prompt, trimmed, max_tokens=1400, fast=True, temperature=0.3)
                if is_refusal(answer):
                    answer = NOTICE_PD + "Пожалуйста, опишите юридическую суть вопроса — и я дам развёрнутый ответ со ссылками на нормы РФ."
                elif had_pd:
                    answer = NOTICE_PD + answer

            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer, "needs_expert": needs_expert}, ensure_ascii=False)}

        # ── Очистка временных файлов ──
        elif mode == "file_cleanup":
            s3 = get_s3()
            deleted = cleanup_temp_files(s3)
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"deleted": len(deleted), "keys": deleted}, ensure_ascii=False)}

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
            messages = body.get("messages", [])
            if not messages:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "messages required"})}

            # Сжимаем старые сообщения в резюме если история длинная
            summarized = summarize_old_messages(messages)
            # Очищаем персональные данные до отправки в Яндекс
            clean_messages, had_pd = strip_personal_data(summarized)

            needs_expert = False
            personal_data_refused = False
            used_deepseek = False

            if messages and messages[0].get("role") == "system":
                custom_system = messages[0].get("content", SYSTEM_CHAT)
                chat_messages = clean_messages[1:]
                answer = call_yandex(custom_system, chat_messages, max_tokens=1200, fast=True)

            elif is_case_law_query(clean_messages):
                answer = call_yandex(SYSTEM_CASE_LAW, clean_messages, max_tokens=1400, fast=True, temperature=0.3)
                if is_case_law_not_found(answer):
                    needs_expert = True
                    answer = answer.rstrip()
                    answer += "\n\n---\nБолее детальный поиск судебной практики по вашему делу может провести наш юрист-эксперт — он имеет доступ к базам КонсультантПлюс и Гарант и подберёт конкретные решения судов по схожим ситуациям."

            else:
                simple = is_simple_query(clean_messages)
                if simple:
                    answer = call_yandex(SYSTEM_CHAT_SIMPLE, clean_messages, max_tokens=600, fast=True)
                else:
                    answer = call_yandex(SYSTEM_CHAT, clean_messages, max_tokens=1400, fast=True, temperature=0.3)

            # ── Fallback на DeepSeek (Яндекс Cloud) если YandexGPT отказал ──────
            if is_refusal(answer):
                print(f"[ROUTER] YandexGPT отказал → fallback DeepSeek V3")
                # DeepSeek получает оригинальные сообщения включая персональные данные
                ds_answer = call_deepseek(
                    SYSTEM_CHAT_DEEPSEEK,
                    summarized,      # оригинал без очистки ПД
                    max_tokens=1000,
                    temperature=0.3,
                )
                # Убираем строку [РЕЗЮМЕ] из финального ответа пользователю
                ds_main, ds_summary = _extract_deepseek_summary(ds_answer)
                answer = ds_main if ds_main else ds_answer

                print(f"[ROUTER] DeepSeek ответил, длина={len(answer)} симв, резюме={'есть' if ds_summary else 'нет'}")

                # Шаг 3: если резюме есть — Яндекс добавляет нормативную базу поверх
                # (только если DeepSeek дал короткий ответ < 400 слов)
                word_count = len(answer.split())
                if ds_summary and word_count < 400:
                    relay_messages = [
                        *clean_messages[:-1],
                        {"role": "user", "content":
                            f"Краткое резюме ситуации: {ds_summary}\n\n"
                            f"Добавь ссылки на конкретные нормы РФ и алгоритм действий (2-3 шага)."}
                    ]
                    try:
                        yandex_relay = call_yandex(
                            SYSTEM_DEEPSEEK_SUMMARY_RELAY,
                            relay_messages,
                            max_tokens=500,
                            fast=True,
                            temperature=0.3,
                        )
                        answer = answer + "\n\n" + yandex_relay
                        print(f"[ROUTER] Яндекс добавил нормы, итого={len(answer)} симв")
                    except Exception as relay_err:
                        print(f"[ROUTER] Яндекс-relay не смог: {relay_err}")
                else:
                    print(f"[ROUTER] Яндекс-relay пропущен (слов={word_count}, резюме={'есть' if ds_summary else 'нет'})")

                used_deepseek = True
                personal_data_refused = False
            else:
                print(f"[ROUTER] YandexGPT ответил штатно, длина={len(answer)} симв")

            truncated = len(answer) > 200 and not bool(re.search(r'[.!?»\d]\s*$', answer.rstrip()))
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