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
import boto3

from auth_handler import (
    handle_register, handle_login, handle_me,
    handle_logout, handle_update_profile,
    handle_consume_question, handle_consume_doc, handle_add_paid_service,
    handle_report, handle_send_otp, handle_verify_otp, sanitize_str,
    handle_lawyer_send, handle_lawyer_messages,
    handle_admin_reports, handle_my_reports,
    handle_business_update_org, handle_business_consume_action,
    handle_business_messages_get, handle_business_messages_save,
)
from prompts import (
    TODAY, SYSTEM_CHAT, SYSTEM_DOC_GENERATE, SYSTEM_FILE_ANALYZE_PROMPT,
    SYSTEM_DOC_BY_TYPE, DOC_STARTERS, REFUSAL_MARKERS,
    SYSTEM_BUSINESS_CHAT, SYSTEM_BUSINESS_CONTRACT,
    SYSTEM_COUNTERPARTY_CHECK, SYSTEM_TAX_ANALYSIS,
)

warnings.filterwarnings("ignore")

YANDEX_MODEL = os.environ.get("YANDEX_MODEL_URI", "gpt://b1gd8kncmd8nf4j7h770/deepseek-v32/latest")

# ───────────────────────────────────────────────
# S3 и файловые утилиты
# ───────────────────────────────────────────────
FILE_TTL = 1800
FILE_BUCKET = "files"
FILE_PREFIX = "temp-docs/"
MAX_FILE_MB = 10
ALLOWED_EXTS = {"pdf", "docx", "doc", "jpeg", "jpg", "png"}


def get_s3():
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


def _call_openai_compat(messages: list, max_tokens: int, temperature: float = 0.1) -> str:
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


def analyze_file_with_yandex(text: str, comment: str, iam_token: str) -> str:
    user_content = f"Вопрос: {comment}\n\n" if comment else ""
    user_content += f"Документ:\n\n{text[:8000]}"
    return _call_openai_compat(
        messages=[
            {"role": "system", "content": SYSTEM_FILE_ANALYZE_PROMPT},
            {"role": "user", "content": user_content},
        ],
        max_tokens=2500,
        temperature=0.1,
    )


CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}


def is_refusal(text: str) -> bool:
    low = text.lower()
    return any(m in low for m in REFUSAL_MARKERS)


MAX_HISTORY = 4


def call_yandex(system_prompt: str, messages: list, max_tokens: int = 1200) -> str:
    recent = messages[-MAX_HISTORY:] if len(messages) > MAX_HISTORY else messages
    openai_messages = [{"role": "system", "content": system_prompt}] + [
        {
            "role": "user" if m.get("role") == "user" else "assistant",
            "content": m.get("content", m.get("text", "")),
        }
        for m in recent
    ]
    return _call_openai_compat(openai_messages, max_tokens)


def handler(event: dict, context) -> dict:
    """AI-юрист (DeepSeek V3) + авторизация. Режимы: chat, doc_chat, doc_generate."""
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
        u = me.get("data", {})
        return handle_lawyer_send(body, u["id"], u.get("isAdmin", False))

    def _lawyer_messages_action():
        me = _get_me()
        if "error" in me: return me
        u = me.get("data", {})
        return handle_lawyer_messages(body, u["id"], u.get("isAdmin", False))

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
                "complaint": "жалобу",
                "application": "заявление/ходатайство",
                "notification": "уведомление",
                "order": "приказ",
                "contract": "договор ГПХ",
                "business_contract": "коммерческий договор",
            }
            label = doc_labels.get(doc_type, "документ")
            system_prompt = SYSTEM_DOC_BY_TYPE.get(doc_type, SYSTEM_DOC_GENERATE)
            prompt = (
                f"Составь {label} на основании следующего описания ситуации:\n\n{details}\n\n"
                f"Там где не хватает конкретных данных (ФИО, адрес, ИНН и т.д.) — "
                f"используй метки-заглушки {{{{ПОЛЕ_НАЗВАНИЕ}}}} (русский язык, подчёркивание). "
                f"Запрещены [...] и ___."
            )
            answer = call_yandex(system_prompt, [{"role": "user", "content": prompt}], max_tokens=2200)
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
            answer = call_yandex(system_prompt, [{"role": "user", "content": prompt}], max_tokens=2500)
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
                            f"{'Вопрос пользователя: ' + comment + chr(10) + chr(10) if comment else ''}"
                            "Это фотография документа. Прочитай весь текст на изображении и проанализируй его с юридической точки зрения по законодательству РФ. "
                            "Укажи тип документа, его суть, права и обязанности сторон, возможные риски. "
                            "Дай конкретные рекомендации со ссылками на статьи законов РФ."
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

            answer = analyze_file_with_yandex(text, comment, iam_token)

            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer, "filename": filename,
                                        "delete_at": int(time.time()) + FILE_TTL}, ensure_ascii=False)}

        # ── Бизнес-чат ──
        elif mode == "business_chat":
            biz_messages = body.get("messages", [])
            org_name = body.get("org_name", "").strip()
            biz_mode = body.get("biz_mode", "chat")  # chat | contract | counterparty | tax | doc_analyze | doc_compare
            if not biz_messages:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "messages required"})}

            if biz_mode == "contract":
                sys_prompt = SYSTEM_BUSINESS_CONTRACT
            elif biz_mode == "counterparty":
                sys_prompt = SYSTEM_COUNTERPARTY_CHECK
            elif biz_mode == "tax":
                sys_prompt = SYSTEM_TAX_ANALYSIS
            elif biz_mode in ("doc_analyze", "doc_compare"):
                sys_prompt = SYSTEM_FILE_ANALYZE_PROMPT
            else:
                sys_prompt = SYSTEM_BUSINESS_CHAT
                if org_name:
                    sys_prompt = sys_prompt + f"\n\nОрганизация клиента: {org_name}"

            answer = call_yandex(sys_prompt, biz_messages, max_tokens=3500)
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer}, ensure_ascii=False)}

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
            answer = call_yandex(SYSTEM_CHAT, cont_messages, max_tokens=2500)
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer}, ensure_ascii=False)}

        # ── Обычный чат-консультация ──
        else:
            messages = body.get("messages", [])
            if not messages:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "messages required"})}
            answer = call_yandex(SYSTEM_CHAT, messages, max_tokens=3000)
            truncated = len(answer) > 200 and not bool(re.search(r'[.!?»\d]\s*$', answer.rstrip()))
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer, "truncated": truncated}, ensure_ascii=False)}

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