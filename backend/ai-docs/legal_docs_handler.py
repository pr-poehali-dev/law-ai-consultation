"""
Минимальный модуль для поиска правовой базы знаний (только чтение).
Используется для инжекта судебной практики и госпошлин в AI-запросы.
"""
import os
import re
import time
import threading
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")

MAX_CHUNKS_FOR_AI = 4
MAX_CHUNK_CHARS = 1800
LEGAL_CACHE_TTL = 7200  # 2 часа — документы меняются редко, кэш экономит ~80% DB-запросов

_legal_cache: dict = {}
_legal_cache_lock = threading.Lock()


def _get_conn():
    return psycopg2.connect(
        os.environ["DATABASE_URL"],
        connect_timeout=5,
        options="-c statement_timeout=8000",
    )


def _extract_query_terms(query: str) -> str:
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


def _get_legal_context_fallback(category: str, max_chunks: int, max_chars: int) -> str:
    cache_key = (category, max_chunks, max_chars)
    now = time.time()
    cached = _legal_cache.get(cache_key)
    if cached and (now - cached[1]) < LEGAL_CACHE_TTL:
        return cached[0]
    try:
        conn = _get_conn()
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

        _INSTRUCTIONS = {
            "case_law": "ДОПОЛНИТЕЛЬНЫЕ МАТЕРИАЛЫ — судебная практика:\nИспользуй если релевантны.",
            "state_duty": "ДОПОЛНИТЕЛЬНЫЕ МАТЕРИАЛЫ — ставки госпошлины:\nИспользуй для расчёта.",
            "court_definitions": "РАЗЪЯСНЕНИЯ СУДОВ:\nИспользуй для правового обоснования. Ссылайся по названию.",
            "codex": "НОРМЫ КОДЕКСОВ РФ:\nИспользуй для точных ссылок на статьи. Указывай номер статьи и кодекс.",
        }
        instruction = _INSTRUCTIONS.get(category, "СПРАВОЧНЫЕ МАТЕРИАЛЫ:")
        separator = "\n\n— — —\n\n"
        result = f"\n\n[СПРАВОЧНЫЕ МАТЕРИАЛЫ]\n{instruction}\n\n{separator.join(parts)}\n[/СПРАВОЧНЫЕ МАТЕРИАЛЫ]"
        with _legal_cache_lock:
            _legal_cache[cache_key] = (result, now)
        return result
    except Exception as e:
        print(f"[LEGAL_DOCS] fallback error: {e}")
        return ""


def get_legal_context_for_ai(category: str, max_files: int = 4, max_chars: int = 1800, query: str = "") -> str:
    """Поиск релевантных материалов из правовой базы знаний для AI-запроса."""
    if not query or not query.strip():
        return _get_legal_context_fallback(category, max_files, max_chars)

    tsquery = _extract_query_terms(query)
    if not tsquery:
        return _get_legal_context_fallback(category, max_files, max_chars)

    try:
        conn = _get_conn()
        cur = conn.cursor()
        try:
            cur.execute(
                f"""SELECT
                        c.content, d.title, d.doc_year,
                        ts_rank(c.content_tsv, to_tsquery('russian', %s)) AS rank,
                        d.court_name, d.case_number
                    FROM {SCHEMA}.legal_doc_chunks c
                    JOIN {SCHEMA}.legal_docs d ON d.id = c.doc_id
                    WHERE
                        d.category = %s AND d.is_active = TRUE
                        AND c.content != ''
                        AND c.content_tsv @@ to_tsquery('russian', %s)
                    ORDER BY rank DESC, COALESCE(d.doc_year, 2020) DESC
                    LIMIT %s""",
                (tsquery, category, tsquery, max_files)
            )
            rows = cur.fetchall()
        finally:
            cur.close()
            conn.close()

        if not rows:
            return _get_legal_context_fallback(category, max_files, max_chars)

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
            header = (f"Из документа «{key}»:" + (f"\n{meta}" if meta else "")
                      if key not in seen else f"(продолжение «{title}»):")
            seen.add(key)
            parts.append(f"{header}\n{content[:max_chars]}")

        _SEARCH_INSTRUCTIONS = {
            "case_law": "РЕЛЕВАНТНАЯ СУДЕБНАЯ ПРАКТИКА (подобрана по теме):\nСсылайся по названию.",
            "state_duty": "АКТУАЛЬНЫЕ СТАВКИ ГОСПОШЛИНЫ:\nИспользуй для расчёта.",
            "court_definitions": "РАЗЪЯСНЕНИЯ СУДОВ (подобраны по теме):\nИспользуй для обоснования правовых позиций. Ссылайся по названию и дате.",
            "codex": "НОРМЫ КОДЕКСОВ РФ (подобраны по теме):\nИспользуй для точных ссылок. Указывай номер статьи и кодекс.",
        }
        instruction = _SEARCH_INSTRUCTIONS.get(category, "СПРАВОЧНЫЕ МАТЕРИАЛЫ:")
        separator = "\n\n— — —\n\n"
        return f"\n\n[СПРАВОЧНЫЕ МАТЕРИАЛЫ]\n{instruction}\n\n{separator.join(parts)}\n[/СПРАВОЧНЫЕ МАТЕРИАЛЫ]"

    except Exception as e:
        print(f"[LEGAL_DOCS] search error: {e}")
        return _get_legal_context_fallback(category, max_files, max_chars)