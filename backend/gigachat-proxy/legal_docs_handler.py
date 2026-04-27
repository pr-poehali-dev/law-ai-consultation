"""
Управление правовой базой знаний: судебная практика и госпошлины.
Файлы хранятся в S3 (legal-docs/case_law/, legal-docs/state_duty/).
Метаданные — в таблице legal_docs.
Только администратор (is_admin=True) может загружать и удалять файлы.
"""
import os
import base64
import io
import json
import time
import threading
import boto3
import psycopg2
import PyPDF2
from docx import Document as DocxDocument
from auth_handler import get_conn, get_user_by_token, _ok, _err

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")

ALLOWED_CATEGORIES = {"case_law", "state_duty"}
ALLOWED_MIME = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 МБ
MAX_TEXT_PER_FILE = 8000           # символов для инжекции в AI
MAX_FILES_FOR_AI = 3               # сколько файлов читаем для одного запроса

# ── Синглтон S3-клиента: создаём один раз на весь контейнер ──────────────────
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

# ── Кэш содержимого legal_docs для AI: TTL 5 минут ───────────────────────────
# Ключ: (category, max_files, max_chars) → (text, timestamp)
_legal_cache: dict = {}
_legal_cache_lock = threading.Lock()
LEGAL_CACHE_TTL = 300  # 5 минут


def _extract_text_from_pdf(data: bytes) -> str:
    """Извлекает текст из PDF."""
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(data))
        parts = []
        for page in reader.pages[:20]:  # не более 20 страниц
            t = page.extract_text() or ""
            if t.strip():
                parts.append(t.strip())
        return "\n\n".join(parts)
    except Exception:
        return ""


def _extract_text_from_docx(data: bytes) -> str:
    """Извлекает текст из DOCX."""
    try:
        doc = DocxDocument(io.BytesIO(data))
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        return "\n".join(paragraphs)
    except Exception:
        return ""


def _extract_text(data: bytes, ext: str) -> str:
    """Универсальный экстрактор текста по расширению."""
    ext = ext.lower()
    if ext == "pdf":
        return _extract_text_from_pdf(data)
    if ext in ("docx", "doc"):
        return _extract_text_from_docx(data)
    return ""


def handle_legal_docs(token: str, body: dict) -> dict:
    """Обработчик API для управления правовой базой знаний."""
    action = body.get("action_sub", "")

    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")

    # Загрузка и удаление — только для админа
    if action in ("upload", "delete") and not user.get("isAdmin", False):
        return _err(403, "Только для администратора")

    conn = get_conn()
    cur = conn.cursor()
    try:
        if action == "list":
            category = body.get("category", "")
            if category and category not in ALLOWED_CATEGORIES:
                return _err(400, "Неверная категория")
            if category:
                cur.execute(
                    f"""SELECT id, category, title, filename, file_size, mime_type,
                               created_at, is_active, description
                        FROM {SCHEMA}.legal_docs
                        WHERE category = %s AND is_active = TRUE
                        ORDER BY created_at DESC""",
                    (category,)
                )
            else:
                cur.execute(
                    f"""SELECT id, category, title, filename, file_size, mime_type,
                               created_at, is_active, description
                        FROM {SCHEMA}.legal_docs
                        WHERE is_active = TRUE
                        ORDER BY category, created_at DESC"""
                )
            rows = cur.fetchall()
            docs = []
            s3_client = _s3()
            key_id = os.environ.get("AWS_ACCESS_KEY_ID", "")
            for row in rows:
                doc_id, cat, title, filename, fsize, mime, created_at, is_active, desc = row
                s3_key = f"legal-docs/{cat}/{doc_id}_{filename}"
                cdn_url = f"https://cdn.poehali.dev/projects/{key_id}/bucket/{s3_key}"
                docs.append({
                    "id": doc_id,
                    "category": cat,
                    "title": title,
                    "filename": filename,
                    "file_size": fsize,
                    "mime_type": mime,
                    "created_at": created_at.isoformat() if created_at else "",
                    "description": desc,
                    "download_url": cdn_url,
                })
            return _ok({"docs": docs})

        elif action == "upload":
            category = body.get("category", "")
            title = (body.get("title") or "").strip()
            description = (body.get("description") or "").strip()
            file_b64 = body.get("file", "")
            filename = (body.get("filename") or "").strip()

            if category not in ALLOWED_CATEGORIES:
                return _err(400, "Категория: case_law или state_duty")
            if not title:
                return _err(400, "Укажите название документа")
            if not file_b64 or not filename:
                return _err(400, "Файл обязателен")

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

            # Сохраняем метаданные в БД
            cur.execute(
                f"""INSERT INTO {SCHEMA}.legal_docs
                    (category, title, filename, s3_key, file_size, mime_type, uploaded_by, description)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id""",
                (category, title, filename, "", len(file_data), mime_type,
                 user.get("id"), description)
            )
            doc_id = cur.fetchone()[0]
            s3_key = f"legal-docs/{category}/{doc_id}_{filename}"
            cur.execute(
                f"UPDATE {SCHEMA}.legal_docs SET s3_key = %s WHERE id = %s",
                (s3_key, doc_id)
            )
            conn.commit()

            # Загружаем в S3
            s3_client = _s3()
            s3_client.put_object(
                Bucket="files",
                Key=s3_key,
                Body=file_data,
                ContentType=mime_type,
            )

            invalidate_legal_cache()
            key_id = os.environ.get("AWS_ACCESS_KEY_ID", "")
            cdn_url = f"https://cdn.poehali.dev/projects/{key_id}/bucket/{s3_key}"
            return _ok({
                "ok": True,
                "id": doc_id,
                "download_url": cdn_url,
            })

        elif action == "delete":
            doc_id = int(body.get("doc_id", 0))
            if not doc_id:
                return _err(400, "Укажите doc_id")
            cur.execute(
                f"SELECT s3_key FROM {SCHEMA}.legal_docs WHERE id = %s",
                (doc_id,)
            )
            row = cur.fetchone()
            if not row:
                return _err(404, "Документ не найден")
            s3_key = row[0]
            # Удаляем из S3
            try:
                s3_client = _s3()
                s3_client.delete_object(Bucket="files", Key=s3_key)
            except Exception as e:
                print(f"[LEGAL_DOCS] S3 delete error: {e}")
            cur.execute(
                f"UPDATE {SCHEMA}.legal_docs SET is_active = FALSE WHERE id = %s",
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


# ── AI-интеграция: получение текстов файлов для инжекции в промпт ──────────

def get_legal_context_for_ai(category: str, max_files: int = MAX_FILES_FOR_AI,
                              max_chars: int = MAX_TEXT_PER_FILE) -> str:
    """
    Читает последние N активных файлов из указанной категории,
    извлекает текст и возвращает блок для инжекции в AI-промпт.
    Результат кэшируется на 5 минут — S3 не читается на каждый запрос.
    """
    cache_key = (category, max_files, max_chars)
    now = time.time()

    # Проверяем кэш (без блокировки — читать dict потокобезопасно в CPython)
    cached = _legal_cache.get(cache_key)
    if cached and (now - cached[1]) < LEGAL_CACHE_TTL:
        return cached[0]

    try:
        conn = get_conn()
        cur = conn.cursor()
        try:
            cur.execute(
                f"""SELECT id, title, filename, s3_key, mime_type
                    FROM {SCHEMA}.legal_docs
                    WHERE category = %s AND is_active = TRUE
                    ORDER BY created_at DESC
                    LIMIT %s""",
                (category, max_files)
            )
            rows = cur.fetchall()
        finally:
            cur.close()
            conn.close()

        if not rows:
            with _legal_cache_lock:
                _legal_cache[cache_key] = ("", now)
            return ""

        # Синглтон S3-клиент (не создаём новый на каждый вызов)
        s3_client = _s3()
        parts = []
        for doc_id, title, filename, s3_key, mime_type in rows:
            try:
                obj = s3_client.get_object(Bucket="files", Key=s3_key)
                data = obj["Body"].read()
                ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
                text = _extract_text(data, ext)
                if text.strip():
                    parts.append(f"Документ: «{title}»\n{text[:max_chars]}")
            except Exception as e:
                print(f"[LEGAL_DOCS] Не удалось прочитать {s3_key}: {e}")
                continue

        if not parts:
            with _legal_cache_lock:
                _legal_cache[cache_key] = ("", now)
            return ""

        if category == "case_law":
            instruction = (
                "ДОПОЛНИТЕЛЬНЫЕ МАТЕРИАЛЫ — судебная практика (загружена администратором).\n"
                "Используй эти материалы ТОЛЬКО если они релевантны запросу пользователя: "
                "цитируй конкретные выводы судов, ссылайся на документ по названию. "
                "Если материалы не относятся к данному вопросу — игнорируй их."
            )
        else:
            instruction = (
                "ДОПОЛНИТЕЛЬНЫЕ МАТЕРИАЛЫ — актуальные ставки госпошлины (загружены администратором).\n"
                "Используй эти данные для точного расчёта пошлины если они применимы. "
                "Если данные не относятся к вопросу — игнорируй их."
            )

        separator = "\n\n— — —\n\n"
        result = f"\n\n[СПРАВОЧНЫЕ МАТЕРИАЛЫ]\n{instruction}\n\n{separator.join(parts)}\n[/СПРАВОЧНЫЕ МАТЕРИАЛЫ]"

        with _legal_cache_lock:
            _legal_cache[cache_key] = (result, now)
        return result

    except Exception as e:
        print(f"[LEGAL_DOCS] get_legal_context error: {e}")
        return ""


def invalidate_legal_cache():
    """Сбрасывает кэш при загрузке/удалении файла администратором."""
    with _legal_cache_lock:
        _legal_cache.clear()


def is_case_law_in_db() -> bool:
    """Проверяет, есть ли файлы судебной практики в базе."""
    try:
        conn = get_conn()
        cur = conn.cursor()
        try:
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.legal_docs WHERE category='case_law' AND is_active=TRUE"
            )
            return cur.fetchone()[0] > 0
        finally:
            cur.close()
            conn.close()
    except Exception:
        return False


def is_state_duty_in_db() -> bool:
    """Проверяет, есть ли файлы госпошлины в базе."""
    try:
        conn = get_conn()
        cur = conn.cursor()
        try:
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.legal_docs WHERE category='state_duty' AND is_active=TRUE"
            )
            return cur.fetchone()[0] > 0
        finally:
            cur.close()
            conn.close()
    except Exception:
        return False