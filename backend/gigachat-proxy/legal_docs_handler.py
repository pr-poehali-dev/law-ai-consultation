"""
Управление правовой базой знаний: судебная практика и госпошлины.
Файлы хранятся в S3, метаданные — в legal_docs, индексированные чанки — в legal_doc_chunks.
При загрузке файл нарезается на куски ~500 слов и индексируется через PostgreSQL tsvector.
При AI-запросе — мгновенный поиск релевантных кусков по ключевым словам запроса пользователя.
"""
import os
import re
import base64
import io
import time
import threading
import boto3
import psycopg2
from auth_handler import get_conn, get_user_by_token, _ok, _err

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")

ALLOWED_CATEGORIES = {"case_law", "state_duty"}
ALLOWED_SUBCATEGORIES = {"civil", "criminal", "administrative", ""}
ALLOWED_MIME = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_YEARS = {2024, 2025, 2026, 2027}
MAX_FILE_SIZE = 10 * 1024 * 1024   # 10 МБ
CHUNK_SIZE = 500                    # слов в одном чанке
CHUNK_OVERLAP = 50                  # слов перекрытия между чанками
MAX_CHUNKS_FOR_AI = 4               # чанков в ответ AI
MAX_CHUNK_CHARS = 1800              # символов одного чанка для AI

# ── S3 синглтон ──────────────────────────────────────────────────────────────
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


# ── Извлечение текста ────────────────────────────────────────────────────────

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
        return "\n\n".join(parts)
    except Exception:
        return ""


def _extract_text_from_docx(data: bytes) -> str:
    """Извлекает текст из DOCX."""
    try:
        from docx import Document as DocxDocument
        doc = DocxDocument(io.BytesIO(data))
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        return "\n".join(paragraphs)
    except Exception:
        return ""


def _extract_text(data: bytes, ext: str) -> str:
    ext = ext.lower()
    if ext == "pdf":
        return _extract_text_from_pdf(data)
    if ext in ("docx", "doc"):
        return _extract_text_from_docx(data)
    return ""


# ── Нарезка текста на чанки ──────────────────────────────────────────────────

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


# ── API-обработчик ───────────────────────────────────────────────────────────

def handle_legal_docs(token: str, body: dict) -> dict:
    """Обработчик API для управления правовой базой знаний."""
    action = body.get("action_sub", "")

    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")

    if action in ("upload", "delete") and not user.get("isAdmin", False):
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
                           created_at, is_active, description, doc_year, subcategory
                    FROM {SCHEMA}.legal_docs
                    WHERE {where_sql}
                    ORDER BY category, doc_year DESC NULLS LAST, created_at DESC""",
                params
            )
            rows = cur.fetchall()
            docs = []
            key_id = os.environ.get("AWS_ACCESS_KEY_ID", "")
            for row in rows:
                doc_id, cat, title, filename, fsize, mime, created_at, is_active, desc, yr, subcat = row
                s3_key = f"legal-docs/{cat}/{doc_id}_{filename}"
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
            s3_key = f"legal-docs/{category}/{doc_id}_{filename}"
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

            _s3().put_object(Bucket="files", Key=s3_key, Body=file_data, ContentType=mime_type)

            invalidate_legal_cache()
            key_id = os.environ.get("AWS_ACCESS_KEY_ID", "")
            cdn_url = f"https://cdn.poehali.dev/projects/{key_id}/bucket/{s3_key}"
            return _ok({
                "ok": True,
                "id": doc_id,
                "chunks_count": chunks_count,
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


# ── Кэш fallback-контекста ───────────────────────────────────────────────────
_legal_cache: dict = {}
_legal_cache_lock = threading.Lock()
LEGAL_CACHE_TTL = 300


def invalidate_legal_cache():
    """Сбрасывает кэш при загрузке/удалении файла."""
    with _legal_cache_lock:
        _legal_cache.clear()


# ── Извлечение ключевых слов из запроса ──────────────────────────────────────

def _extract_query_terms(query: str) -> str:
    """
    Превращает запрос в tsquery для PostgreSQL (с префиксным поиском).
    """
    clean = re.sub(r"[^\w\s]", " ", query.lower())
    words = clean.split()
    stop = {
        "и","в","на","с","по","для","что","как","это","все","или","но","а","у",
        "из","за","от","до","при","если","то","не","к","о","об","во","со","же",
        "бы","ли","уже","еще","ещё","мне","мы","вы","он","она","они","был",
        "быть","есть","так","там","тут","вот","да","нет","меня","тебя","его","её",
        "их","мой","твой","наш","ваш","свой","я","ты","под","над","без","между",
    }
    terms = [w for w in words if len(w) > 2 and w not in stop]
    if not terms:
        return ""
    return " | ".join(f"{t}:*" for t in terms[:12])


# ── Умный поиск по чанкам ────────────────────────────────────────────────────

def search_legal_chunks(query: str, category: str = "case_law",
                        max_chunks: int = MAX_CHUNKS_FOR_AI,
                        max_chars: int = MAX_CHUNK_CHARS) -> str:
    """
    Мгновенный полнотекстовый поиск по индексированным чанкам.
    Возвращает только релевантные абзацы — экономит токены AI.
    """
    if not query or not query.strip():
        return get_legal_context_fallback(category, max_chunks, max_chars)

    tsquery = _extract_query_terms(query)
    if not tsquery:
        return get_legal_context_fallback(category, max_chunks, max_chars)

    try:
        conn = get_conn()
        cur = conn.cursor()
        try:
            cur.execute(
                f"""SELECT
                        c.content,
                        d.title,
                        d.doc_year,
                        ts_rank(c.content_tsv, to_tsquery('russian', %s)) AS rank,
                        d.court_name,
                        d.case_number
                    FROM {SCHEMA}.legal_doc_chunks c
                    JOIN {SCHEMA}.legal_docs d ON d.id = c.doc_id
                    WHERE
                        d.category = %s
                        AND d.is_active = TRUE
                        AND c.content != ''
                        AND c.content_tsv @@ to_tsquery('russian', %s)
                    ORDER BY
                        rank DESC,
                        COALESCE(d.doc_year, 2020) DESC
                    LIMIT %s""",
                (tsquery, category, tsquery, max_chunks)
            )
            rows = cur.fetchall()
        finally:
            cur.close()
            conn.close()

        if not rows:
            return get_legal_context_fallback(category, max_chunks, max_chars)

        parts = []
        seen = set()
        for content, title, doc_year, rank, court_name, case_number in rows:
            year_label = f" ({doc_year} г.)" if doc_year else ""
            key = f"{title}{year_label}"
            meta_parts = []
            if court_name:
                meta_parts.append(f"Суд: {court_name}")
            if case_number:
                meta_parts.append(f"Дело № {case_number}")
            meta = " | ".join(meta_parts)
            if key not in seen:
                header = f"Из документа «{key}»:"
                if meta:
                    header += f"\n{meta}"
            else:
                header = f"(продолжение «{title}»):"
            seen.add(key)
            parts.append(f"{header}\n{content[:max_chars]}")

        if category == "case_law":
            instruction = (
                "РЕЛЕВАНТНАЯ СУДЕБНАЯ ПРАКТИКА (подобрана автоматически по теме запроса):\n"
                "Используй для обоснования ответа. Ссылайся на документ по названию."
            )
        else:
            instruction = (
                "АКТУАЛЬНЫЕ СТАВКИ ГОСПОШЛИНЫ (подобраны по теме запроса):\n"
                "Используй для точного расчёта пошлины."
            )

        separator = "\n\n— — —\n\n"
        return f"\n\n[СПРАВОЧНЫЕ МАТЕРИАЛЫ]\n{instruction}\n\n{separator.join(parts)}\n[/СПРАВОЧНЫЕ МАТЕРИАЛЫ]"

    except Exception as e:
        print(f"[LEGAL_DOCS] search_legal_chunks error: {e}")
        return get_legal_context_fallback(category, max_chunks, max_chars)


def get_legal_context_fallback(category: str, max_chunks: int = MAX_CHUNKS_FOR_AI,
                                max_chars: int = MAX_CHUNK_CHARS) -> str:
    """Fallback: последние N чанков без учёта запроса (кэш 5 мин)."""
    cache_key = (category, max_chunks, max_chars)
    now = time.time()
    cached = _legal_cache.get(cache_key)
    if cached and (now - cached[1]) < LEGAL_CACHE_TTL:
        return cached[0]

    try:
        conn = get_conn()
        cur = conn.cursor()
        try:
            cur.execute(
                f"""SELECT c.content, d.title, d.doc_year, d.court_name, d.case_number
                    FROM {SCHEMA}.legal_doc_chunks c
                    JOIN {SCHEMA}.legal_docs d ON d.id = c.doc_id
                    WHERE d.category = %s AND d.is_active = TRUE AND c.content != ''
                    ORDER BY COALESCE(d.doc_year, 2020) DESC, d.created_at DESC, c.chunk_index ASC
                    LIMIT %s""",
                (category, max_chunks)
            )
            rows = cur.fetchall()
        finally:
            cur.close()
            conn.close()

        if not rows:
            with _legal_cache_lock:
                _legal_cache[cache_key] = ("", now)
            return ""

        parts = []
        for content, title, doc_year, court_name, case_number in rows:
            year_label = f" ({doc_year} г.)" if doc_year else ""
            meta_parts = []
            if court_name:
                meta_parts.append(f"Суд: {court_name}")
            if case_number:
                meta_parts.append(f"Дело № {case_number}")
            meta = " | ".join(meta_parts)
            header = f"Из документа «{title}{year_label}»:"
            if meta:
                header += f"\n{meta}"
            parts.append(f"{header}\n{content[:max_chars]}")

        if category == "case_law":
            instruction = (
                "ДОПОЛНИТЕЛЬНЫЕ МАТЕРИАЛЫ — судебная практика:\n"
                "Используй если релевантны запросу пользователя."
            )
        else:
            instruction = (
                "ДОПОЛНИТЕЛЬНЫЕ МАТЕРИАЛЫ — ставки госпошлины:\n"
                "Используй для расчёта пошлины."
            )

        separator = "\n\n— — —\n\n"
        result = f"\n\n[СПРАВОЧНЫЕ МАТЕРИАЛЫ]\n{instruction}\n\n{separator.join(parts)}\n[/СПРАВОЧНЫЕ МАТЕРИАЛЫ]"
        with _legal_cache_lock:
            _legal_cache[cache_key] = (result, now)
        return result

    except Exception as e:
        print(f"[LEGAL_DOCS] fallback error: {e}")
        return ""


# ── Обратная совместимость ────────────────────────────────────────────────────

def get_legal_context_for_ai(category: str, max_files: int = 3,
                              max_chars: int = MAX_CHUNK_CHARS,
                              query: str = "") -> str:
    """
    Универсальная точка входа для index.py.
    Если передан query — умный поиск. Иначе — fallback (последние чанки).
    """
    if query and query.strip():
        return search_legal_chunks(query, category, MAX_CHUNKS_FOR_AI, max_chars)
    return get_legal_context_fallback(category, MAX_CHUNKS_FOR_AI, max_chars)


def is_case_law_in_db() -> bool:
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