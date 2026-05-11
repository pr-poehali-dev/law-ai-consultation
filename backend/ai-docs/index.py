"""
AI-документы — генерация, анализ и продолжение документов.
Режимы: doc_generate, doc_continue, file_analyze, file_cleanup.
Таймаут: 90 секунд.
"""
import json
import os
import re
import base64
import io
import time
import threading
import requests

from prompts import (
    SYSTEM_DOC_GENERATE, SYSTEM_FILE_ANALYZE_PROMPT, SYSTEM_FILE_QA_PROMPT,
    SYSTEM_DOC_BY_TYPE, REFUSAL_MARKERS, LEGAL_QUALITY_ADDON,
)
try:
    from prompts.block_router import get_system_prompt_for_doc, get_doc_label
    _BLOCK_ROUTER_OK = True
except Exception:
    _BLOCK_ROUTER_OK = False
from state_duty import is_duty_query, get_duty_context_for_doc, DUTY_DOC_TYPES
from legal_docs_handler import get_legal_context_for_ai
from penalty_prompt import PENALTY_CALC_SYSTEM, PENALTY_CALC_PROMPT

YANDEX_MODEL = os.environ.get("YANDEX_MODEL_URI", "gpt://b1gd8kncmd8nf4j7h770/deepseek-v32/latest")
YANDEX_MODEL_FAST = "gpt://b1gd8kncmd8nf4j7h770/yandexgpt-5.1/latest"
_IAM_TOKEN: str = os.environ.get("YANDEX_IAM_TOKEN", "").strip()

_http = requests.Session()
_http.headers.update({"Content-Type": "application/json"})

_RE_TRUNCATED = re.compile(r'[.!?»\d]\s*$')
_RE_PLACEHOLDER = re.compile(r'\{\{([^}]+)\}\}')
_RE_DOC_END_SPEECH = re.compile(r'(прошу\s+суд|прошу\s+уважаемый|на\s+основании\s+изложенного|итог|в\s+заключение)', re.I)
_RE_DOC_END_OTHER = re.compile(r'(подпись|реквизиты|экземпляр|дата\s*[:|]?\s*«|\d{1,2}\.\d{2}\.\d{4})', re.I)

SPEECH_DOC_TYPES = {"court_speech"}

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

FILE_TTL = 1800
FILE_BUCKET = "files"
FILE_PREFIX = "temp-docs/"
MAX_FILE_MB = 10
ALLOWED_EXTS = {"pdf", "docx", "doc", "jpeg", "jpg", "png", "txt", "heic", "heif", "webp", "bmp", "tiff", "tif"}

# ── Персональные данные ────────────────────────────────────────────────────
_PD_PATTERNS = [
    (re.compile(r'\b\d{3}-\d{3}-\d{3}\s\d{2}\b'), '{{СНИЛС}}'),
    (re.compile(r'\bИНН[:\s]+\d{10,12}\b', re.IGNORECASE), '{{ИНН}}'),
    (re.compile(r'\bОГРН[:\s]+\d{13,15}\b', re.IGNORECASE), '{{ОГРН}}'),
    (re.compile(r'(паспорт|серия паспорта|выдан)[^,;\n]{0,40}\d{4}\s?\d{6}', re.IGNORECASE), '{{ПАСПОРТНЫЕ_ДАННЫЕ}}'),
    (re.compile(r'(?<!\d)\d{4}\s\d{6}(?!\d)'), '{{ПАСПОРТ}}'),
    (re.compile(r'(дата\s+рождения|д\.р\.|дата\sвыдачи|выдан\s+\d)[:\s]*\d{1,2}[./]\d{1,2}[./]\d{2,4}', re.IGNORECASE), '{{ДАТА}}'),
]

def _sanitize_doc_text(text: str) -> str:
    result = text
    for pattern, replacement in _PD_PATTERNS:
        result = pattern.sub(replacement, result)
    return result

# ── AI-вызовы ─────────────────────────────────────────────────────────────
MAX_HISTORY = 10

def is_refusal(text) -> bool:
    if not text:
        return False
    low = text.lower()
    return any(m in low for m in REFUSAL_MARKERS)

def call_yandex(system_prompt: str, messages: list, max_tokens: int = 1200, fast: bool = False, temperature: float = 0.3) -> str:
    recent = messages[-MAX_HISTORY:] if len(messages) > MAX_HISTORY else messages
    openai_messages = [{"role": "system", "content": system_prompt}] + [
        {"role": "user" if m.get("role") == "user" else "assistant",
         "content": m.get("content", m.get("text", ""))}
        for m in recent
    ]
    model = YANDEX_MODEL_FAST if fast else YANDEX_MODEL
    timeout = 30 if fast else 80
    resp = _http.post(
        "https://llm.api.cloud.yandex.net/v1/chat/completions",
        headers={"Authorization": f"Api-Key {_IAM_TOKEN}"},
        json={"model": model, "messages": openai_messages, "max_tokens": max_tokens, "temperature": temperature, "stream": False},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]

def call_deepseek(system_prompt: str, messages: list, max_tokens: int = 800, temperature: float = 0.3, timeout: int = 80) -> tuple:
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

# ── Файловые утилиты ───────────────────────────────────────────────────────
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
    s3.put_object(Bucket=FILE_BUCKET, Key=key, Body=data, ContentType=content_type, Metadata={"uploaded_at": str(ts)})
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

def extract_pdf_text(data: bytes, char_limit: int = 8000) -> str:
    import PyPDF2
    reader = PyPDF2.PdfReader(io.BytesIO(data))
    parts = []
    total = 0
    for page in reader.pages[:15]:
        text = page.extract_text() or ""
        parts.append(text)
        total += len(text)
        if total >= char_limit:
            break
    result = "\n".join(parts).strip()[:char_limit]
    if len(result.strip()) < 50 and _IAM_TOKEN:
        try:
            b64_pdf = base64.b64encode(data).decode("utf-8")
            vision_resp = _http.post(
                "https://vision.api.cloud.yandex.net/vision/v1/batchAnalyze",
                headers={"Authorization": f"Api-Key {_IAM_TOKEN}"},
                json={"analyzeSpecs": [{"content": b64_pdf, "features": [{"type": "TEXT_DETECTION", "textDetectionConfig": {"languageCodes": ["ru", "en"]}}], "mimeType": "application/pdf"}]},
                timeout=15,
            )
            if vision_resp.ok:
                blocks = (vision_resp.json().get("results", [{}])[0].get("results", [{}])[0].get("textDetection", {}).get("pages", []))
                lines = []
                for page in blocks:
                    for block in page.get("blocks", []):
                        for line in block.get("lines", []):
                            words = [w.get("text", "") for w in line.get("words", [])]
                            if words:
                                lines.append(" ".join(words))
                ocr_text = "\n".join(lines).strip()
                if ocr_text and len(ocr_text.strip()) > 30:
                    return ocr_text[:char_limit]
        except Exception:
            pass
    return result

def extract_docx_text(data: bytes, char_limit: int = 12000) -> str:
    from docx import Document as DocxDocument
    doc = DocxDocument(io.BytesIO(data))
    parts = []
    total = 0
    for p in doc.paragraphs:
        if p.text.strip():
            parts.append(p.text)
            total += len(p.text)
            if total >= char_limit:
                break
    return "\n".join(parts)[:char_limit]

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
            buf.seek(0); buf.truncate()
            img.save(buf, format="JPEG", quality=quality, optimize=True)
            if buf.tell() <= max_bytes:
                break
            quality -= 15
        return buf.getvalue()
    except Exception:
        return image_data[:max_bytes]

def extract_image_text_ocr(image_data: bytes, ext: str) -> str:
    if not _IAM_TOKEN:
        return ""
    ext_lower = ext.lower()
    if ext_lower not in ("jpg", "jpeg", "png"):
        try:
            from PIL import Image as PILImage
            img = PILImage.open(io.BytesIO(image_data))
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            image_data = buf.getvalue()
            ext_lower = "jpg"
        except Exception:
            pass
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}
    mime_type = mime_map.get(ext_lower, "image/jpeg")
    compressed = _compress_image(image_data)
    b64_image = base64.b64encode(compressed).decode("utf-8")
    try:
        resp = _http.post(
            "https://vision.api.cloud.yandex.net/vision/v1/batchAnalyze",
            headers={"Authorization": f"Api-Key {_IAM_TOKEN}"},
            json={"analyzeSpecs": [{"content": b64_image, "features": [{"type": "TEXT_DETECTION", "textDetectionConfig": {"languageCodes": ["ru", "en"]}}], "mimeType": mime_type}]},
            timeout=12,
        )
        if not resp.ok:
            return ""
        result = resp.json()
        blocks = (result.get("results", [{}])[0].get("results", [{}])[0].get("textDetection", {}).get("pages", []))
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

def analyze_file_with_yandex(text: str, comment: str, iam_token: str, n_docs: int = 1) -> str:
    TEXT_LIMIT = min(2500 + (n_docs - 1) * 800, 4500)
    MAX_TOKENS = min(1200 + (n_docs - 1) * 400, 2000)
    clean_text = _sanitize_doc_text(text)[:TEXT_LIMIT]
    if comment:
        user_content = f"Вопрос: {comment}\n\nДокумент:\n\n{clean_text}"
        system_prompt = SYSTEM_FILE_QA_PROMPT
    else:
        user_content = f"Документ для анализа:\n\n{clean_text}"
        if n_docs > 1:
            system_prompt = SYSTEM_FILE_ANALYZE_PROMPT + f"\n\nВАЖНО: загружено {n_docs} документа(ов). Анализируй каждый отдельно — кратко (3–5 пунктов на документ), уложись в ответ целиком."
        else:
            system_prompt = SYSTEM_FILE_ANALYZE_PROMPT
    messages_for_ds = [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_content}]
    resp = _http.post(
        "https://llm.api.cloud.yandex.net/v1/chat/completions",
        headers={"Authorization": f"Api-Key {iam_token}"},
        json={"model": YANDEX_MODEL, "messages": messages_for_ds, "max_tokens": MAX_TOKENS, "temperature": 0.2, "stream": False},
        timeout=45,
    )
    resp.raise_for_status()
    result = resp.json()["choices"][0]["message"]["content"].strip()
    print(f"[FILE_ANALYZE] OK: {len(result)} симв, docs={n_docs}")
    return result


def handler(event: dict, context) -> dict:
    """AI-документы: генерация, анализ файлов, продолжение. Таймаут 90с."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    if event.get("httpMethod") == "GET":
        return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"ok": True, "service": "ai-docs"})}

    headers = event.get("headers") or {}
    token = headers.get("X-Auth-Token") or headers.get("x-auth-token", "")

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    mode = body.get("mode", "")

    try:
        # ── Очистка временных файлов ─────────────────────────────────────────
        if mode == "file_cleanup":
            s3 = get_s3()
            deleted = cleanup_temp_files(s3)
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"deleted": len(deleted), "keys": deleted}, ensure_ascii=False)}

        # ── Продолжение обрезанного документа ───────────────────────────────
        if mode == "doc_continue":
            doc_type = body.get("doc_type", "claim")
            partial = body.get("partial", "").strip()
            if not partial:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "partial required"})}
            system_prompt = get_system_prompt_for_doc(doc_type) if _BLOCK_ROUTER_OK else SYSTEM_DOC_BY_TYPE.get(doc_type, SYSTEM_DOC_GENERATE)
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

        # ── Генерация документа ──────────────────────────────────────────────
        if mode == "doc_generate":
            _mode_start = time.time()
            if not token:
                return {"statusCode": 401, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "Требуется авторизация"}, ensure_ascii=False)}
            doc_type = body.get("doc_type", "claim")
            details = body.get("details", "").strip()
            file_b64 = body.get("file", "")
            filename = body.get("filename", "")
            if not details:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "details required"})}

            if _BLOCK_ROUTER_OK:
                label = get_doc_label(doc_type)
                system_prompt = get_system_prompt_for_doc(doc_type)
            else:
                doc_labels = {
                    "claim": "исковое заявление", "pretension": "досудебную претензию",
                    "complaint": "жалобу", "application": "заявление/ходатайство",
                    "notification": "уведомление", "contract": "договор ГПХ",
                    "court_speech": "судебную речь", "response_to_claim": "отзыв на иск",
                    "objection": "возражение", "appeal": "апелляционную жалобу",
                    "cassation": "кассационную жалобу", "supervisory": "надзорную жалобу",
                }
                label = doc_labels.get(doc_type, "документ")
                system_prompt = SYSTEM_DOC_BY_TYPE.get(doc_type, SYSTEM_DOC_GENERATE)

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
                last_pairs = chat_history[-5:]
                history_context = "КОНТЕКСТ ИЗ ПРЕДЫДУЩЕЙ КОНСУЛЬТАЦИИ (используй все упомянутые факты, стороны, суммы, даты):\n"
                for msg in last_pairs:
                    role_label = "Пользователь" if msg.get("role") == "user" else "Юрист"
                    content_raw = msg.get("content", "")[:800]
                    result = content_raw
                    for pattern, replacement in _PD_PATTERNS:
                        result = pattern.sub(replacement, result)
                    history_context += f"{role_label}: {result}\n"
                history_context += "\nВАЖНО: подстави все конкретные данные из диалога напрямую в документ. Где данных нет — используй метки {{{{ПОЛЕ_НАЗВАНИЕ}}}}.\n\n"

            speech_style = ""
            if doc_type in SPEECH_DOC_TYPES:
                speech_style = (
                    "ОРАТОРСКИЙ СТИЛЬ (обязательно): короткие предложения (7–12 слов), паузы (//), "
                    "тройные перечисления, сильные глаголы, один тезис на абзац. "
                    "Ключевую мысль — в начало и в конец. Без воды и длинных оборотов.\n\n"
                )

            # Параллельно запрашиваем все 4 категории правовой базы
            _duty_db_result: list = []
            _case_law_result: list = []
            _definitions_result: list = []
            _codex_result: list = []

            def _fetch_duty_db():
                if doc_type in DUTY_DOC_TYPES:
                    _duty_db_result.append(get_legal_context_for_ai("state_duty", max_files=2, max_chars=3000, query=details))
            # Для коротких кадровых документов правовая база не нужна — не перегружаем промт
            def _fetch_case_law():
                if doc_type not in (_MEDIUM_DOC_TYPES | _SHORT_DOC_TYPES):
                    _case_law_result.append(get_legal_context_for_ai("case_law", max_files=2, max_chars=3000, query=details))
            def _fetch_definitions():
                if doc_type not in (_MEDIUM_DOC_TYPES | _SHORT_DOC_TYPES):
                    _definitions_result.append(get_legal_context_for_ai("court_definitions", max_files=2, max_chars=3000, query=details))
            def _fetch_codex():
                if doc_type not in (_MEDIUM_DOC_TYPES | _SHORT_DOC_TYPES):
                    _codex_result.append(get_legal_context_for_ai("codex", max_files=3, max_chars=3000, query=details))

            threads = [
                threading.Thread(target=_fetch_duty_db, daemon=True),
                threading.Thread(target=_fetch_case_law, daemon=True),
                threading.Thread(target=_fetch_definitions, daemon=True),
                threading.Thread(target=_fetch_codex, daemon=True),
            ]
            for t in threads: t.start()
            for t in threads: t.join(timeout=8)

            duty_block = (get_duty_context_for_doc() if doc_type in DUTY_DOC_TYPES else "") + (_duty_db_result[0] if _duty_db_result else "")
            case_law_block = _case_law_result[0] if _case_law_result else ""
            definitions_block = _definitions_result[0] if _definitions_result else ""
            codex_block = _codex_result[0] if _codex_result else ""
            extra_context = duty_block + case_law_block + definitions_block + codex_block
            print(f"[DOC_GEN] Правовая база: duty={bool(duty_block)}, case_law={bool(case_law_block)}, definitions={bool(definitions_block)}, codex={bool(codex_block)}")

            prompt = (
                history_context + speech_style
                + f"Составь {label} на основании следующего описания ситуации:\n\n{details}\n\n"
                + (f"Дополнительные материалы из загруженного файла ({filename}):\n{file_context}\n\n" if file_context else "")
                + LEGAL_QUALITY_ADDON + extra_context
                + f"\nТам где не хватает конкретных данных (ФИО, адрес, номер дела и т.д.) — "
                f"используй метки-заглушки {{{{ПОЛЕ_НАЗВАНИЕ}}}} (русский язык, подчёркивание). "
                f"Запрещены [...] и ___."
            )
            # DeepSeek fallback использует тот же prompt что и Яндекс
            raw_prompt = prompt

            # Лимиты токенов по типам документов
            _SHORT_DOC_TYPES = {
                # Простые согласия и расписки — реально короткие документы
                "contract_receipt", "special_pd_consent", "special_medical_consent",
            }
            _MEDIUM_DOC_TYPES = {
                # Приказы — стандартные кадровые документы
                "labor_order_hire", "labor_order_dismiss",
                "labor_order_bonus", "labor_order_discipline",
            }
            _LONG_DOC_TYPES = {
                # Уставы, корпоративные акты, сложные договоры — до 4500 токенов
                "corporate_charter", "corporate_collective", "corporate_rules",
                "contract_gov", "website_terms", "website_privacy", "website_eula",
                "contract_marriage", "special_will", "special_inheritance_contract",
            }
            if doc_type in _SHORT_DOC_TYPES:
                _max_tokens = 400
            elif doc_type in _MEDIUM_DOC_TYPES:
                _max_tokens = 1800
            elif doc_type in _LONG_DOC_TYPES:
                _max_tokens = 4500
            else:
                _max_tokens = 3500

            answer = ""
            _yandex_refused = False
            try:
                answer = call_yandex(system_prompt, [{"role": "user", "content": prompt}], max_tokens=_max_tokens, temperature=0.15)
                if is_refusal(answer):
                    _yandex_refused = True
            except Exception as e:
                print(f"[DOC_GEN] YandexGPT упал: {e} → fallback DeepSeek V3")
                _yandex_refused = True

            if _yandex_refused:
                print(f"[DOC_GEN] YandexGPT отказал → fallback DeepSeek V3")
                # Сбрасываем отказной ответ Яндекса — DeepSeek должен написать нормальный документ
                _refused_text = answer
                answer = ""
                try:
                    ds_answer, _ = call_deepseek(system_prompt, [{"role": "user", "content": raw_prompt}], max_tokens=_max_tokens, temperature=0.15, timeout=80)
                    if ds_answer and not is_refusal(ds_answer):
                        answer = ds_answer
                        print(f"[DOC_GEN] DeepSeek ответил, симв={len(answer)}")
                    else:
                        print(f"[DOC_GEN] DeepSeek тоже отказал")
                except Exception as e:
                    print(f"[DOC_GEN] DeepSeek тоже упал: {e}")

            if not answer:
                return {"statusCode": 500, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "Не удалось сгенерировать документ. Попробуйте ещё раз."}, ensure_ascii=False)}

            if doc_type in SPEECH_DOC_TYPES:
                truncated = not bool(_RE_DOC_END_SPEECH.search(answer[-400:]))
            else:
                truncated = not bool(_RE_DOC_END_OTHER.search(answer[-300:]))
            placeholders = list(dict.fromkeys(_RE_PLACEHOLDER.findall(answer)))
            # Рекомендации теперь запрашиваются отдельно (mode=doc_recommendations) после показа документа
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer, "placeholders": placeholders, "truncated": truncated}, ensure_ascii=False)}

        # ── Анализ файлов ────────────────────────────────────────────────────
        if mode == "file_analyze":
            comment = body.get("comment", "").strip()
            iam_token = os.environ["YANDEX_IAM_TOKEN"].strip()
            mime_map = {
                "pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "doc": "application/msword", "jpeg": "image/jpeg", "jpg": "image/jpeg",
                "png": "image/png", "txt": "text/plain",
            }

            raw_files = body.get("files", [])
            if not raw_files:
                f_b64 = body.get("file", "")
                f_name = body.get("filename", "document")
                if f_b64:
                    raw_files = [{"file": f_b64, "filename": f_name}]
            if not raw_files:
                return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "file required"}, ensure_ascii=False)}
            if len(raw_files) > 3:
                raw_files = raw_files[:3]

            extract_results = [None] * len(raw_files)

            def _extract_one(idx, fi):
                fb64 = fi.get("file", "")
                fname = fi.get("filename", "document")
                if not fb64:
                    return
                fdata = base64.b64decode(fb64)
                if len(fdata) > MAX_FILE_MB * 1024 * 1024:
                    return
                ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
                if ext not in ALLOWED_EXTS:
                    return
                ct = mime_map.get(ext, "application/octet-stream")
                def _bg_up(d=fdata, n=fname, c=ct):
                    try:
                        s3 = get_s3(); save_temp_file(s3, d, n, c); cleanup_temp_files(s3)
                    except Exception: pass
                threading.Thread(target=_bg_up, daemon=True).start()
                if ext == "pdf":
                    extract_results[idx] = (fname, extract_pdf_text(fdata), None)
                elif ext in ("docx", "doc"):
                    extract_results[idx] = (fname, extract_docx_text(fdata), None)
                elif ext == "txt":
                    extract_results[idx] = (fname, fdata.decode("utf-8", errors="replace")[:12000], None)
                else:
                    compressed = _compress_image(fdata, max_bytes=700_000)
                    ocr_b64 = base64.b64encode(compressed).decode("utf-8")
                    t = extract_image_text_ocr(compressed, ext)
                    if not t or len(t.strip()) < 15:
                        extract_results[idx] = (fname, "", ocr_b64)
                    else:
                        extract_results[idx] = (fname, t, None)

            extract_threads = [threading.Thread(target=_extract_one, args=(i, fi), daemon=True) for i, fi in enumerate(raw_files)]
            for t in extract_threads: t.start()
            for t in extract_threads: t.join(timeout=15)

            file_texts = [r for r in extract_results if r is not None]
            filenames_list = [r[0] for r in file_texts]
            first_ocr_b64 = next((r[2] for r in file_texts if r[2]), None)

            if not file_texts:
                return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "Не удалось обработать файлы. Проверьте формат и размер."}, ensure_ascii=False)}

            combined_parts = []
            all_ocr_failed = True
            for fname, txt, ocr_b64 in file_texts:
                if txt and len(txt.strip()) >= 15:
                    all_ocr_failed = False
                    label = f"[Файл: {fname}]" if len(file_texts) > 1 else ""
                    combined_parts.append(f"{label}\n{txt.strip()}" if label else txt.strip())

            combined_text = "\n\n---\n\n".join(combined_parts)
            combined_filename = filenames_list[0] if len(filenames_list) == 1 else f"{filenames_list[0]} +{len(filenames_list)-1}"

            # Vision fallback для фото без OCR-текста
            if all_ocr_failed and first_ocr_b64:
                try:
                    n_files = len(file_texts)
                    vision_intro = f"Ты — опытный юрист РФ. Пользователь загрузил {'фото документа' if n_files == 1 else f'{n_files} фото документов'}.\n\n"
                    vision_task = (
                        f"Вопрос пользователя: {comment}\n\nОтвечай СТРОГО на этот вопрос, используя документ как источник фактов. Не делай общий анализ — только ответ со ссылками на статьи законов РФ."
                        if comment else
                        "СТРОГО ЗАПРЕЩЕНО: пересказывать текст документа.\n\nДай краткое практическое юридическое заключение:\n**Тип и суть** — одной фразой.\n**Правовые риски** — со статьёй закона РФ: 🔴 критично / 🟡 существенно / 🟢 незначительно.\n**Что делать** — 1–3 практических шага."
                    )
                    user_msg_content = [
                        {"type": "text", "text": vision_intro + vision_task + "\n\nЕсли фото нечёткое — скажи об этом."},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{first_ocr_b64}"}},
                    ]
                    vision_resp = requests.post(
                        "https://llm.api.cloud.yandex.net/v1/chat/completions",
                        headers={"Authorization": f"Api-Key {iam_token}", "Content-Type": "application/json"},
                        json={"model": "gpt://b1g2k5n3ojr7ik7lv73l/yandexgpt-vision-lite/latest", "messages": [{"role": "user", "content": user_msg_content}], "max_tokens": 2000, "temperature": 0.1},
                        timeout=30,
                    )
                    if vision_resp.ok:
                        answer = vision_resp.json()["choices"][0]["message"]["content"]
                        return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                                "body": json.dumps({"answer": answer, "filename": filenames_list[0], "delete_at": int(time.time()) + FILE_TTL}, ensure_ascii=False)}
                except Exception:
                    pass

            if not combined_text or len(combined_text.strip()) < 20:
                return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "Не удалось извлечь текст из файлов. Попробуйте PDF или DOCX."}, ensure_ascii=False)}

            analysis_result = [None]
            analysis_error = [None]
            hint_result = [None]
            n_files = len(file_texts)

            def _do_analysis():
                try:
                    analysis_result[0] = analyze_file_with_yandex(combined_text, comment, iam_token, n_docs=n_files)
                except Exception as _ae:
                    analysis_error[0] = str(_ae)
                    print(f"[FILE_ANALYZE] Поток упал: {_ae}")

            def _do_hint():
                doc_types_list = "claim — исковое заявление, pretension — досудебная претензия, complaint — жалоба, application — заявление/ходатайство, notification — уведомление, order — приказ, contract — договор ГПХ, business_contract — коммерческий договор, court_speech — судебная речь, response_to_claim — отзыв на исковое заявление, objection — возражение, appeal — апелляционная жалоба, cassation — кассационная жалоба, supervisory — надзорная жалоба"
                doc_intro = f"Пользователь загрузил {n_files} документа" if n_files > 1 else "Пользователь загрузил документ"
                if comment:
                    hint_prompt = (
                        f"Ты — помощник юриста. {doc_intro} и ЯВНО УКАЗАЛ какой документ нужно составить.\n\n"
                        f"ЗАПРОС ПОЛЬЗОВАТЕЛЯ (ПРИОРИТЕТ): {comment}\n\n"
                        f"Доступные типы документов: {doc_types_list}\n\n"
                        f"Текст документа:\n{combined_text[:3000]}\n\n"
                        f"Ответь СТРОГО в JSON:\n"
                        f'{{"doc_type": "id_типа", "details": "подробное описание для генерации", "doc_label": "название на русском"}}'
                    )
                else:
                    hint_prompt = (
                        f"Ты — помощник юриста. {doc_intro}. Определи какой ответный документ нужно составить.\n"
                        f"Доступные типы: {doc_types_list}\n\nТекст:\n{combined_text[:5000]}\n\n"
                        f"Ответь СТРОГО в JSON:\n"
                        f'{{"doc_type": "id_типа", "details": "подробное описание", "doc_label": "название на русском"}}'
                    )
                try:
                    resp = requests.post(
                        "https://llm.api.cloud.yandex.net/v1/chat/completions",
                        headers={"Authorization": f"Api-Key {iam_token}", "Content-Type": "application/json"},
                        json={"model": YANDEX_MODEL_FAST, "messages": [{"role": "user", "content": hint_prompt}], "max_tokens": 800, "temperature": 0.1, "stream": False},
                        timeout=30,
                    )
                    resp.raise_for_status()
                    raw = resp.json()["choices"][0]["message"]["content"]
                    match = re.search(r'\{[\s\S]*\}', raw)
                    if match:
                        hint_result[0] = json.loads(match.group())
                except Exception:
                    pass

            _analyze_start = time.time()
            t_analysis = threading.Thread(target=_do_analysis, daemon=True)
            t_hint = threading.Thread(target=_do_hint, daemon=True)
            t_analysis.start(); t_hint.start()
            t_analysis.join(timeout=50)
            t_hint.join(timeout=15)

            if not analysis_result[0]:
                err_msg = "Анализ занял слишком много времени. Попробуйте ещё раз." if not analysis_error[0] else "Не удалось проанализировать документ. Попробуйте ещё раз."
                return {"statusCode": 502, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": err_msg}, ensure_ascii=False)}

            response_data = {
                "answer": analysis_result[0],
                "filename": combined_filename,
                "delete_at": int(time.time()) + FILE_TTL,
                "extracted_text": combined_text[:6000],
            }
            if hint_result[0]:
                response_data["doc_hint"] = hint_result[0]
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps(response_data, ensure_ascii=False)}

        # ── Расчёт неустойки ─────────────────────────────────────────────────
        if mode == "penalty_calc":
            if not token:
                return {"statusCode": 401, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "Unauthorized"}, ensure_ascii=False)}
            calc_data = body.get("calc_data", "")
            if not calc_data:
                return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "calc_data required"}, ensure_ascii=False)}
            penalty_prompt_text = PENALTY_CALC_PROMPT.format(calc_data=calc_data)
            pen_answer = ""
            # fast=True + timeout=30 — точно укладываемся, расчёт не требует большой модели
            try:
                pen_answer = call_yandex(PENALTY_CALC_SYSTEM, [{"role": "user", "content": penalty_prompt_text}], max_tokens=2000, fast=True, temperature=0.05)
            except Exception as e:
                print(f"[PENALTY_CALC] Яндекс упал: {e}")
            if not pen_answer:
                return {"statusCode": 500, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "Не удалось выполнить расчёт. Попробуйте ещё раз."}, ensure_ascii=False)}
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": pen_answer}, ensure_ascii=False)}

        # ── Генерация документа по рекомендации ──────────────────────────────
        if mode == "rec_doc_generate":
            if not token:
                return {"statusCode": 401, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "Unauthorized"}, ensure_ascii=False)}
            rec_doc_type = body.get("rec_doc_type", "")
            rec_context = body.get("rec_context", "")
            rec_reason = body.get("rec_reason", "")
            if not rec_doc_type or not rec_context:
                return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "rec_doc_type and rec_context required"}, ensure_ascii=False)}

            REC_DOC_LABELS = {
                "motion_restore_term": "ходатайство о восстановлении срока",
                "motion_evidence": "ходатайство об истребовании доказательств",
                "motion_witness": "ходатайство о вызове свидетеля",
                "motion_third_party": "ходатайство о привлечении третьего лица",
                "motion_expertise": "ходатайство о назначении экспертизы",
                "motion_enforcement": "ходатайство об обеспечении иска",
                "pretension": "досудебную претензию",
                "complaint": "жалобу",
                "appeal": "апелляционную жалобу",
            }
            rec_label = REC_DOC_LABELS.get(rec_doc_type, "дополнительный документ")
            rec_system = (
                "Ты — опытный российский юрист. Составь юридически грамотный документ. "
                "Используй формат с блоками [ШАПКА], [ЗАГОЛОВОК], [ТЕКСТ], [ПРИЛОЖЕНИЯ], [ПОДПИСЬ]. "
                "Где нет конкретных данных — ставь {{ПОЛЕ_НАЗВАНИЕ}}. "
                "Запрещены [...] и ___."
            )
            rec_prompt_text = (
                f"Составь {rec_label} на основании следующего контекста.\n\n"
                f"Контекст основного документа:\n{rec_context[:2000]}\n\n"
                f"Обоснование необходимости: {rec_reason}\n\n"
                "Составь полный готовый документ со ссылками на нормы ТК/ГПК/АПК/ГК РФ."
            )
            rec_answer = ""
            try:
                rec_answer = call_yandex(rec_system, [{"role": "user", "content": rec_prompt_text}], max_tokens=2500, temperature=0.1)
            except Exception as e:
                print(f"[REC_DOC] Яндекс упал: {e} → fallback")
            if not rec_answer or is_refusal(rec_answer):
                try:
                    rec_answer, _ = call_deepseek(rec_system, [{"role": "user", "content": rec_prompt_text}], max_tokens=2500, temperature=0.1, timeout=70)
                except Exception as e:
                    print(f"[REC_DOC] DeepSeek упал: {e}")
            if not rec_answer:
                return {"statusCode": 500, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "Не удалось создать документ. Попробуйте ещё раз."}, ensure_ascii=False)}
            rec_placeholders = list(dict.fromkeys(_RE_PLACEHOLDER.findall(rec_answer)))
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": rec_answer, "placeholders": rec_placeholders, "label": rec_label}, ensure_ascii=False)}

        # ── Анализ рекомендаций (вызывается отдельно после показа документа) ──
        if mode == "doc_recommendations":
            if not token:
                return {"statusCode": 401, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "Unauthorized"}, ensure_ascii=False)}
            doc_name = body.get("doc_name", "Документ")
            doc_content = body.get("doc_content", "").strip()
            if not doc_content:
                return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "doc_content required"}, ensure_ascii=False)}
            rec_sys = (
                "Ты — опытный юрист РФ. Кратко определи, нужны ли дополнительные действия к документу. "
                "Отвечай ТОЛЬКО JSON, без пояснений."
            )
            rec_pr = (
                f"Документ «{doc_name}»:\n{doc_content}\n\n"
                "Нужны ли пользователю дополнительные юридические действия?\n"
                "Верни JSON:\n"
                '{"recommendations": ['
                '{"type": "penalty_calc", "title": "Расчёт неустойки", "reason": "..."} | '
                '{"type": "doc", "doc_type": "motion_restore_term", "title": "...", "reason": "..."}'
                ']}\n'
                "Типы doc_type: motion_restore_term, motion_evidence, motion_witness, motion_third_party, "
                "motion_expertise, motion_enforcement, pretension, complaint, appeal\n"
                "ТОЛЬКО если реально необходимо. Максимум 2. Пустой список если не нужно."
            )
            recs_raw = []
            try:
                raw = call_yandex(rec_sys, [{"role": "user", "content": rec_pr}], max_tokens=500, fast=True, temperature=0.1)
                m = re.search(r'\{[\s\S]*\}', raw)
                if m:
                    parsed = json.loads(m.group())
                    recs_raw = parsed.get("recommendations", [])
                    if not isinstance(recs_raw, list): recs_raw = []
                    recs_raw = recs_raw[:2]
            except Exception as e:
                print(f"[DOC_RECS] ошибка: {e}")
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"recommendations": recs_raw}, ensure_ascii=False)}

        # ── AI-анализ документа (помощник) ────────────────────────────────────
        if mode == "doc_ai_review":
            if not token:
                return {"statusCode": 401, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "Unauthorized"}, ensure_ascii=False)}
            doc_name = body.get("doc_name", "Документ")
            doc_content = body.get("doc_content", "").strip()
            if not doc_content:
                return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "doc_content required"}, ensure_ascii=False)}
            review_system = (
                "Ты — опытный юрист РФ. Анализируй юридические документы кратко и ёмко. "
                "Структурируй ответ чётко по разделам с эмодзи-маркерами. "
                "Отвечай строго в указанном JSON-формате."
            )
            # Обрезаем документ до 2500 символов — оптимально для анализа
            doc_for_review = doc_content[:2500]
            review_prompt = (
                f"Проанализируй документ «{doc_name}» (первые символы):\n\n"
                f"{doc_for_review}\n\n"
                "Дай заключение СТРОГО в формате (используй эти маркеры):\n"
                "⚖️ ЮРИДИЧЕСКАЯ КОРРЕКТНОСТЬ\n[1-2 предложения: есть ли ошибки/неточности]\n\n"
                "📊 ПЕРСПЕКТИВА\n[высокая/средняя/низкая + одна фраза обоснования]\n\n"
                "📋 РЕКОМЕНДАЦИИ\n[2-3 конкретных улучшения]\n\n"
                "Верни JSON:\n"
                '{"answer": "текст заключения выше", "recommendations": ['
                '{"type": "penalty_calc", "title": "Расчёт неустойки", "reason": "..."} | '
                '{"type": "doc", "doc_type": "TYPE", "title": "...", "reason": "..."}]}\n'
                "doc_type: motion_restore_term|motion_evidence|motion_witness|motion_third_party|"
                "motion_expertise|motion_enforcement|pretension|complaint|appeal\n"
                "Максимум 2 рекомендации. Пустой список если не нужно."
            )
            review_answer = ""
            review_recs = []
            # Лимит 2000 токенов — быстро и в таймаут
            REVIEW_MAX_TOKENS = 2000
            try:
                raw = call_yandex(review_system, [{"role": "user", "content": review_prompt}], max_tokens=REVIEW_MAX_TOKENS, fast=True, temperature=0.1)
                m = re.search(r'\{[\s\S]*\}', raw)
                if m:
                    parsed = json.loads(m.group())
                    review_answer = parsed.get("answer", raw)
                    review_recs = parsed.get("recommendations", [])
                else:
                    review_answer = raw
            except Exception as e:
                print(f"[DOC_REVIEW] Яндекс упал: {e}")
            if not review_answer:
                return {"statusCode": 500, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "Не удалось провести анализ. Попробуйте ещё раз."}, ensure_ascii=False)}
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": review_answer, "recommendations": review_recs}, ensure_ascii=False)}

        # ── Редактирование документа AI-помощником ────────────────────────────
        if mode == "doc_edit":
            if not token:
                return {"statusCode": 401, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "Unauthorized"}, ensure_ascii=False)}
            doc_name = body.get("doc_name", "Документ")
            doc_content = body.get("doc_content", "").strip()
            edit_instruction = body.get("edit_instruction", "").strip()
            if not doc_content or not edit_instruction:
                return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "doc_content and edit_instruction required"}, ensure_ascii=False)}

            # Оцениваем объём: если документ очень большой, обрезаем до 6000 символов
            doc_for_edit = doc_content[:6000]
            doc_truncated_for_edit = len(doc_content) > 6000

            edit_system = (
                "Ты — опытный юрист-редактор РФ. Вносишь правки в юридический документ.\n"
                "РЕЖИМЫ (определяй по инструкции):\n"
                "— РЕДАКЦИЯ: заменяешь конкретные фразы/абзацы на улучшенные юридические формулировки.\n"
                "— ДОПОЛНЕНИЕ: вставляешь новый текст (до 2000 символов) в нужное место документа.\n"
                "ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА:\n"
                "1. Изменяй ТОЛЬКО то, что прямо указано в инструкции.\n"
                "2. Весь остальной текст — дословно, без малейших изменений.\n"
                "3. Сохраняй блоки [ШАПКА][ЗАГОЛОВОК][ТЕЛО][ТРЕБОВАНИЯ][ПРИЛОЖЕНИЯ][ПОДПИСЬ][ОБОСНОВАНИЕ][ПРИМЕЧАНИЯ].\n"
                "4. Качество важнее скорости: юридически корректные формулировки со ссылками на нормы РФ.\n"
                "5. Верни ТОЛЬКО текст документа — без пояснений, без предисловий.\n"
                "6. Запрещены [...], ___ и заглушки вместо существующего текста.\n"
                "7. Если правка не влезает полностью — добавь в конец: ##PARTIAL## и одной строкой что не вошло."
            )
            edit_prompt = (
                f"ДОКУМЕНТ «{doc_name}» (передаётся для редактирования):\n"
                "━━━━━━━━━━━━━━━━━━━━━━\n"
                f"{doc_for_edit}\n"
                "━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"ЗАДАЧА: {edit_instruction}\n\n"
                "Если задача — РЕДАКЦИЯ: найди указанный участок и замени на юридически корректный вариант.\n"
                "Если задача — ДОПОЛНЕНИЕ: вставь новый текст в логичное место документа (можно до 2000 символов).\n"
                "Верни ПОЛНЫЙ документ с внесёнными изменениями. Остальное — дословно."
            )
            edit_answer = ""
            # fast=True → yandexgpt, timeout=30 → укладываемся в таймаут функции
            try:
                edit_answer = call_yandex(edit_system, [{"role": "user", "content": edit_prompt}], max_tokens=2000, fast=True, temperature=0.1)
            except Exception as e:
                print(f"[DOC_EDIT] Яндекс упал: {e}")
            if not edit_answer:
                return {"statusCode": 500, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "Не удалось отредактировать документ. Попробуйте ещё раз."}, ensure_ascii=False)}

            # Проверяем частичное внесение
            partial_note = ""
            if "##PARTIAL##" in edit_answer:
                parts = edit_answer.split("##PARTIAL##", 1)
                edit_answer = parts[0].strip()
                partial_note = parts[1].strip() if len(parts) > 1 else "Часть правки не вошла в лимит"
            # Если документ был обрезан для редактирования — восстанавливаем хвост оригинала
            if doc_truncated_for_edit and edit_answer:
                # Добавляем часть оригинала, которую не передавали AI
                edit_answer = edit_answer + "\n" + doc_content[6000:]

            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": edit_answer, "partial_note": partial_note}, ensure_ascii=False)}

        return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"error": f"Unknown mode: {mode}"})}

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