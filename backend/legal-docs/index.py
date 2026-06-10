"""Управление правовой базой знаний: загрузка, список, удаление документов. Поддерживает PDF, DOCX, ODT до 10 МБ. v2 — OTP защита удаления."""
import json
import os
import re
import base64
import io
import time
import threading
import random
import smtplib
from email.mime.text import MIMEText
from email.header import Header
import boto3
import psycopg2
from datetime import datetime

# ─────────────────────────────────────────────
# Константы
# ─────────────────────────────────────────────

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

ALLOWED_CATEGORIES = {"case_law", "state_duty", "court_definitions", "codex"}
ALLOWED_SUBCATEGORIES = {"civil", "criminal", "administrative", ""}
ALLOWED_MIME = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "odt": "application/vnd.oasis.opendocument.text",
}
ALLOWED_YEARS = {2024, 2025, 2026, 2027}
MAX_FILE_SIZE = 10 * 1024 * 1024   # 10 МБ
CHUNK_SIZE = 500                    # слов в одном чанке
CHUNK_OVERLAP = 50                  # слов перекрытия между чанками
MAX_CHUNKS_FOR_AI = 4               # чанков в ответ AI
MAX_CHUNK_CHARS = 1800              # символов одного чанка для AI

_SELECT_COLS = (
    "id, email, name, phone, free_questions_used, paid_questions, "
    "paid_docs, paid_expert, paid_business, is_admin, "
    "subscription_consult_until, subscription_docs_until, "
    "business_subscription_until, business_actions_left, business_org_name, referral_code"
)

# ─────────────────────────────────────────────
# S3 синглтон
# ─────────────────────────────────────────────

_s3_client = None
_s3_lock = threading.Lock()


def _s3():
    global _s3_client
    if _s3_client is None:
        with _s3_lock:
            if _s3_client is None:
                _s3_client = boto3.client(
                    "s3",
                    endpoint_url="https://bucket.poehali.dev",
                    aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
                    aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
                )
    return _s3_client


# ─────────────────────────────────────────────
# Извлечение текста
# ─────────────────────────────────────────────

def _extract_text_from_pdf(data: bytes) -> str:
    """Извлекает текст из PDF (до 50 страниц)."""
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(data))
        parts = []
        for page in reader.pages[:50]:
            t = page.extract_text() or ""
            if t.strip():
                parts.append(t.strip())
        result = "\n\n".join(parts)
        print(f"[LEGAL_PDF] извлечено {len(result)} символов из {len(reader.pages)} страниц")
        return result
    except Exception as e:
        print(f"[LEGAL_PDF] ошибка извлечения: {e}")
        return ""


def _extract_text_from_docx(data: bytes) -> str:
    """Извлекает текст из DOCX."""
    try:
        from docx import Document as DocxDocument
        doc = DocxDocument(io.BytesIO(data))
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        result = "\n".join(paragraphs)
        print(f"[LEGAL_DOCX] извлечено {len(result)} символов")
        return result
    except Exception as e:
        print(f"[LEGAL_DOCX] ошибка извлечения: {e}")
        return ""


def _extract_text_from_odt(data: bytes) -> str:
    """Извлекает текст из ODT (OpenDocument Text)."""
    try:
        import zipfile
        from xml.etree import ElementTree as ET
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            with z.open("content.xml") as f:
                tree = ET.parse(f)
        ns = "urn:oasis:names:tc:opendocument:xmlns:text:1.0"
        parts = []
        for elem in tree.iter():
            if elem.tag in (f"{{{ns}}}p", f"{{{ns}}}h"):
                text = "".join(elem.itertext()).strip()
                if text:
                    parts.append(text)
        result = "\n".join(parts)
        print(f"[LEGAL_ODT] извлечено {len(result)} символов")
        return result
    except Exception as e:
        print(f"[LEGAL_ODT] ошибка извлечения: {e}")
        return ""


def _extract_text(data: bytes, ext: str) -> str:
    ext = ext.lower()
    if ext == "pdf":
        return _extract_text_from_pdf(data)
    if ext in ("docx", "doc"):
        return _extract_text_from_docx(data)
    if ext == "odt":
        return _extract_text_from_odt(data)
    return ""


# ─────────────────────────────────────────────
# Нарезка текста на чанки
# ─────────────────────────────────────────────

def _split_into_chunks(text: str, chunk_words: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list:
    """
    Нарезает текст на перекрывающиеся куски по ~chunk_words слов.
    Старается разрезать по границе предложения.
    """
    words = text.split()
    if not words:
        return []
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_words, len(words))
        chunk_text = " ".join(words[start:end])
        if end < len(words):
            tail = " ".join(words[max(start, end - 80):end])
            last_dot = max(tail.rfind(". "), tail.rfind(".\n"), tail.rfind("! "), tail.rfind("? "))
            if last_dot > 0:
                sentence_end = len(" ".join(words[start:max(start, end - 80)])) + last_dot + 2
                chunk_text = chunk_text[:sentence_end].strip()
        if chunk_text.strip():
            chunks.append(chunk_text.strip())
        start += chunk_words - overlap
    return chunks


def _save_chunks(conn, doc_id: int, text: str) -> int:
    """Нарезает текст и сохраняет чанки в БД с tsvector-индексом."""
    cur = conn.cursor()
    # Обнуляем старые чанки через UPDATE (не DELETE — политика БД)
    cur.execute(
        f"UPDATE {SCHEMA}.legal_doc_chunks SET content = '', content_tsv = NULL WHERE doc_id = %s",
        (doc_id,)
    )
    chunks = _split_into_chunks(text)
    for idx, chunk in enumerate(chunks):
        cur.execute(
            f"""INSERT INTO {SCHEMA}.legal_doc_chunks
                (doc_id, chunk_index, content, content_tsv)
                VALUES (%s, %s, %s, to_tsvector('russian', %s))""",
            (doc_id, idx, chunk, chunk)
        )
    cur.close()
    return len(chunks)


# ─────────────────────────────────────────────
# Кэш
# ─────────────────────────────────────────────

_legal_cache: dict = {}
_legal_cache_lock = threading.Lock()
LEGAL_CACHE_TTL = 300


def invalidate_legal_cache():
    """Сбрасывает кэш при загрузке/удалении файла."""
    with _legal_cache_lock:
        _legal_cache.clear()


# ─────────────────────────────────────────────
# OTP-хранилище для подтверждения удаления
# ─────────────────────────────────────────────

_delete_otps: dict[str, tuple[str, float]] = {}  # doc_id → (code, expires_at)


def _send_email(to_email: str, subject: str, body_text: str) -> None:
    smtp_from = os.environ.get("SMTP_FROM_EMAIL", "").strip()
    smtp_pass = os.environ.get("SMTP_PASSWORD", "").strip()
    if not smtp_from or not smtp_pass:
        raise RuntimeError("SMTP не настроен")
    msg = MIMEText(body_text, "plain", "utf-8")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = smtp_from
    msg["To"] = to_email
    try:
        with smtplib.SMTP_SSL("smtp.yandex.ru", 465, timeout=15) as server:
            server.login(smtp_from, smtp_pass)
            server.sendmail(smtp_from, [to_email], msg.as_string())
        return
    except Exception as e1:
        pass
    with smtplib.SMTP("smtp.yandex.ru", 587, timeout=15) as server:
        server.ehlo(); server.starttls(); server.ehlo()
        server.login(smtp_from, smtp_pass)
        server.sendmail(smtp_from, [to_email], msg.as_string())


# ─────────────────────────────────────────────
# Функции из auth_handler.py
# ─────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(
        os.environ["DATABASE_URL"],
        connect_timeout=8,
        options="-c statement_timeout=15000",
    )


def _ok(data: dict) -> dict:
    return {"status": 200, "data": data}


def _err(code: int, msg: str) -> dict:
    return {"status": code, "error": msg}


def _format_user(row) -> dict:
    def _fmt_dt(v):
        if v is None:
            return None
        if isinstance(v, datetime):
            return v.isoformat()
        return str(v)

    return {
        "id": row[0],
        "email": row[1],
        "name": row[2],
        "phone": row[3],
        "freeQuestionsUsed": row[4],
        "paidQuestions": row[5],
        "paidDocs": row[6],
        "paidExpert": row[7],
        "paidBusiness": row[8],
        "isAdmin": bool(row[9]),
        "subscriptionConsultUntil": _fmt_dt(row[10]),
        "subscriptionDocsUntil": _fmt_dt(row[11]),
        "businessSubscriptionUntil": _fmt_dt(row[12]) if len(row) > 12 else None,
        "businessActionsLeft": row[13] if len(row) > 13 else 0,
        "businessOrgName": row[14] if len(row) > 14 else "",
        "referralCode": row[15] if len(row) > 15 else "",
    }


def get_user_by_token(token: str) -> dict | None:
    if not token or len(token) > 200:
        return None
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT {_SELECT_COLS} FROM {SCHEMA}.users
                WHERE id = (
                    SELECT user_id FROM {SCHEMA}.sessions
                    WHERE token = %s AND expires_at > NOW()
                )""",
            (token,)
        )
        row = cur.fetchone()
        return _format_user(row) if row else None
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# Основной обработчик (из legal_docs_handler.py)
# ─────────────────────────────────────────────

def handle_legal_docs(token: str, body: dict) -> dict:
    """Обработчик API для управления правовой базой знаний."""
    # Поддерживаем оба варианта ключа: action_sub (оригинал) и sub (краткий)
    action = body.get("action_sub") or body.get("sub", "")

    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")

    if action in ("upload", "delete", "delete-request-otp") and not user.get("isAdmin", False):
        return _err(403, "Только для администратора")

    conn = get_conn()
    cur = conn.cursor()
    try:
        if action == "list":
            category = body.get("category", "")
            subcategory = body.get("subcategory", "")
            doc_year = body.get("doc_year", None)

            if category and category not in ALLOWED_CATEGORIES:
                return _err(400, "Неверная категория")

            where_clauses = ["is_active = TRUE"]
            params = []
            if category:
                where_clauses.append("category = %s")
                params.append(category)
            if subcategory:
                where_clauses.append("subcategory = %s")
                params.append(subcategory)
            if doc_year:
                where_clauses.append("doc_year = %s")
                params.append(int(doc_year))

            where_sql = " AND ".join(where_clauses)
            cur.execute(
                f"""SELECT id, category, title, filename, file_size, mime_type,
                           created_at, is_active, description, doc_year, subcategory, s3_key
                    FROM {SCHEMA}.legal_docs
                    WHERE {where_sql}
                    ORDER BY category, doc_year DESC NULLS LAST, created_at DESC""",
                params
            )
            rows = cur.fetchall()
            docs = []
            key_id = os.environ.get("AWS_ACCESS_KEY_ID", "")
            s3_client = _s3()
            for row in rows:
                doc_id, cat, title, filename, fsize, mime, created_at, is_active, desc, yr, subcat, db_s3_key = row
                # Берём s3_key из БД, fallback на вычисленный
                s3_key = db_s3_key if db_s3_key else f"legal-docs/{cat}/{doc_id}_{filename}"
                # Генерируем presigned URL для скачивания (1 час)
                try:
                    cdn_url = s3_client.generate_presigned_url(
                        "get_object",
                        Params={"Bucket": "files", "Key": s3_key},
                        ExpiresIn=3600,
                    )
                except Exception:
                    cdn_url = f"https://cdn.poehali.dev/projects/{key_id}/bucket/{s3_key}"
                cur.execute(
                    f"SELECT COUNT(*) FROM {SCHEMA}.legal_doc_chunks WHERE doc_id = %s AND content != ''",
                    (doc_id,)
                )
                chunks_count = cur.fetchone()[0]
                docs.append({
                    "id": doc_id,
                    "category": cat,
                    "subcategory": subcat or "",
                    "doc_year": yr,
                    "title": title,
                    "filename": filename,
                    "file_size": fsize,
                    "mime_type": mime,
                    "created_at": created_at.isoformat() if created_at else "",
                    "description": desc,
                    "download_url": cdn_url,
                    "chunks_count": chunks_count,
                })
            return _ok({"docs": docs})

        elif action == "search":
            # Полнотекстовый поиск по чанкам с ранжированием
            query = (body.get("query") or "").strip()
            category = body.get("category", "case_law")
            limit = min(int(body.get("limit", 8)), 20)

            if not query:
                return _err(400, "Укажите поисковый запрос")
            if category not in ALLOWED_CATEGORIES:
                return _err(400, "Неверная категория")

            import re as _re
            stop_words = {
                "и","в","на","с","по","для","что","как","это","все","или","но","а","у","из","за",
                "от","до","при","если","то","не","к","о","об","во","со","же","бы","ли","уже",
                "еще","ещё","мне","мы","вы","он","она","они","был","быть","есть","так","там",
                "тут","вот","да","нет","я","ты","под","над","без","между",
            }
            words = _re.sub(r"[^\w\s]", " ", query.lower()).split()
            terms = [w for w in words if len(w) > 2 and w not in stop_words]

            if not terms:
                return _ok({"results": [], "total": 0})

            tsquery = " | ".join(f"{t}:*" for t in terms[:12])

            cur.execute(
                f"""SELECT
                        c.content,
                        d.title, d.filename, d.doc_year, d.court_name, d.case_number,
                        d.description,
                        ts_rank(c.content_tsv, to_tsquery('russian', %s)) AS rank
                    FROM {SCHEMA}.legal_doc_chunks c
                    JOIN {SCHEMA}.legal_docs d ON d.id = c.doc_id
                    WHERE
                        d.category = %s AND d.is_active = TRUE
                        AND c.content != ''
                        AND c.content_tsv @@ to_tsquery('russian', %s)
                    ORDER BY rank DESC
                    LIMIT %s""",
                (tsquery, category, tsquery, limit)
            )
            rows = cur.fetchall()

            results = []
            seen_titles = {}
            for content, title, filename, doc_year, court_name, case_number, description, rank in rows:
                # Берём не более 2 чанков на документ
                if seen_titles.get(title, 0) >= 2:
                    continue
                seen_titles[title] = seen_titles.get(title, 0) + 1
                results.append({
                    "title": title,
                    "filename": filename or title,
                    "doc_year": doc_year,
                    "court_name": court_name or "",
                    "case_number": case_number or "",
                    "description": description or "",
                    "snippet": content[:600],
                    "rank": float(rank),
                })

            return _ok({"results": results, "total": len(results)})

        elif action == "upload":
            category = body.get("category", "")
            subcategory = (body.get("subcategory") or "").strip()
            doc_year = body.get("doc_year", None)
            title = (body.get("title") or "").strip()
            description = (body.get("description") or "").strip()
            court_name = (body.get("court_name") or "").strip()
            case_number = (body.get("case_number") or "").strip()
            file_b64 = body.get("file", "")
            filename = (body.get("filename") or "").strip()

            if category not in ALLOWED_CATEGORIES:
                return _err(400, "Категория: case_law или state_duty")
            if category == "case_law" and subcategory and subcategory not in ALLOWED_SUBCATEGORIES:
                return _err(400, "Подкатегория: civil, criminal или administrative")
            if not title:
                return _err(400, "Укажите название документа")
            if not file_b64 or not filename:
                return _err(400, "Файл обязателен")
            if doc_year is not None:
                doc_year = int(doc_year)
                if doc_year not in ALLOWED_YEARS:
                    return _err(400, "Год: 2024, 2025, 2026 или 2027")

            ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            if ext not in ALLOWED_MIME:
                return _err(400, f"Формат не поддерживается. Разрешены: {', '.join(ALLOWED_MIME)}")

            try:
                file_data = base64.b64decode(file_b64)
            except Exception:
                return _err(400, "Ошибка декодирования файла")

            if len(file_data) > MAX_FILE_SIZE:
                return _err(400, "Файл слишком большой (максимум 10 МБ)")

            mime_type = ALLOWED_MIME[ext]

            cur.execute(
                f"""INSERT INTO {SCHEMA}.legal_docs
                    (category, subcategory, doc_year, title, filename, s3_key,
                     file_size, mime_type, uploaded_by, description, court_name, case_number)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id""",
                (category, subcategory or "", doc_year, title, filename, "",
                 len(file_data), mime_type, user.get("id"), description,
                 court_name, case_number)
            )
            doc_id = cur.fetchone()[0]
            # Санируем имя файла: убираем кириллицу, пробелы и спецсимволы
            safe_filename = re.sub(r"[^\w.\-]", "_", filename, flags=re.ASCII)
            safe_filename = re.sub(r"_+", "_", safe_filename).strip("_") or f"doc_{doc_id}.{ext}"
            s3_key = f"legal-docs/{category}/{doc_id}_{safe_filename}"
            cur.execute(
                f"UPDATE {SCHEMA}.legal_docs SET s3_key = %s WHERE id = %s",
                (s3_key, doc_id)
            )

            # Извлекаем текст и нарезаем на чанки
            text = _extract_text(file_data, ext)
            chunks_count = 0
            if text.strip():
                chunks_count = _save_chunks(conn, doc_id, text)

            conn.commit()

            print(f"[S3_UPLOAD] key={s3_key!r} size={len(file_data)} mime={mime_type!r}")
            try:
                _s3().put_object(Bucket="files", Key=s3_key, Body=file_data, ContentType=mime_type)
                print(f"[S3_UPLOAD] OK")
            except Exception as s3_err:
                print(f"[S3_UPLOAD] ERROR: {s3_err!r}")
                # Пробуем с упрощённым ключом без имени файла
                s3_key_fallback = f"legal-docs/{category}/{doc_id}.{ext}"
                print(f"[S3_UPLOAD] fallback key={s3_key_fallback!r}")
                _s3().put_object(Bucket="files", Key=s3_key_fallback, Body=file_data, ContentType=mime_type)
                s3_key = s3_key_fallback
                cur2 = conn.cursor()
                cur2.execute(f"UPDATE {SCHEMA}.legal_docs SET s3_key = %s WHERE id = %s", (s3_key, doc_id))
                conn.commit()
                print(f"[S3_UPLOAD] fallback OK")

            invalidate_legal_cache()
            key_id = os.environ.get("AWS_ACCESS_KEY_ID", "")
            cdn_url = f"https://cdn.poehali.dev/projects/{key_id}/bucket/{s3_key}"
            return _ok({
                "ok": True,
                "id": doc_id,
                "chunks_count": chunks_count,
                "download_url": cdn_url,
            })

        elif action == "delete-request-otp":
            doc_id = int(body.get("doc_id", 0))
            if not doc_id:
                return _err(400, "Укажите doc_id")
            # Получаем название документа
            cur.execute(f"SELECT title FROM {SCHEMA}.legal_docs WHERE id = %s AND is_active = TRUE", (doc_id,))
            row = cur.fetchone()
            if not row:
                return _err(404, "Документ не найден")
            doc_title = row[0]
            # Генерируем OTP
            code = str(random.randint(100000, 999999))
            _delete_otps[str(doc_id)] = (code, time.time() + 600)  # 10 минут
            try:
                _send_email(
                    "ilya.povarchuk@mail.ru",
                    f"Удаление документа из правовой базы",
                    f"Код подтверждения удаления документа «{doc_title}»:\n\n{code}\n\nКод действителен 10 минут.\nЕсли вы не запрашивали удаление — проигнорируйте письмо."
                )
            except Exception as e:
                return _err(500, f"Ошибка отправки письма: {e}")
            return _ok({"ok": True, "message": "Код отправлен на ilya.povarchuk@mail.ru"})

        elif action == "delete":
            doc_id = int(body.get("doc_id", 0))
            otp_code = str(body.get("otp_code", "")).strip()
            if not doc_id:
                return _err(400, "Укажите doc_id")
            # Проверяем OTP
            stored = _delete_otps.get(str(doc_id))
            if not stored:
                return _err(403, "Сначала запросите код подтверждения")
            stored_code, expires_at = stored
            if time.time() > expires_at:
                del _delete_otps[str(doc_id)]
                return _err(403, "Код подтверждения истёк. Запросите новый.")
            if otp_code != stored_code:
                return _err(403, "Неверный код подтверждения")
            # OTP верный — удаляем
            del _delete_otps[str(doc_id)]
            cur.execute(
                f"SELECT s3_key FROM {SCHEMA}.legal_docs WHERE id = %s",
                (doc_id,)
            )
            row = cur.fetchone()
            if not row:
                return _err(404, "Документ не найден")
            s3_key = row[0]
            try:
                _s3().delete_object(Bucket="files", Key=s3_key)
            except Exception as e:
                print(f"[LEGAL_DOCS] S3 delete error: {e}")
            cur.execute(
                f"UPDATE {SCHEMA}.legal_docs SET is_active = FALSE WHERE id = %s",
                (doc_id,)
            )
            cur.execute(
                f"UPDATE {SCHEMA}.legal_doc_chunks SET content = '', content_tsv = NULL WHERE doc_id = %s",
                (doc_id,)
            )
            conn.commit()
            invalidate_legal_cache()
            return _ok({"ok": True})

        return _err(400, f"Неизвестное действие: {action}")

    except Exception as e:
        conn.rollback()
        return _err(500, str(e))
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# Главный обработчик
# ─────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Legal-docs service: управление правовой базой знаний."""

    # OPTIONS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    # GET keep-alive
    if event.get("httpMethod") == "GET":
        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"ok": True, "service": "legal-docs"}, ensure_ascii=False),
        }

    # Парсим тело запроса
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    # Токен из заголовков
    headers = event.get("headers") or {}
    token = headers.get("X-Auth-Token") or headers.get("x-auth-token", "")

    def _json_response(status: int, data: dict) -> dict:
        return {
            "statusCode": status,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False),
        }

    try:
        result = handle_legal_docs(token, body)
        status = result.get("status", 200)
        if "error" in result:
            return _json_response(status, {"error": result["error"]})
        return _json_response(200, result.get("data", {}))
    except Exception as e:
        print(f"[LEGAL_DOCS] handler error: {e}")
        return _json_response(500, {"error": "Внутренняя ошибка сервера"})