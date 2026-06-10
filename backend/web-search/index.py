"""Поиск судебной практики через Yandex Search API с фильтрацией по юридическим сайтам. v2"""
import json
import os
import re
import urllib.request
import urllib.parse
import urllib.error

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

# Приоритетные источники для каждого типа запроса
LEGAL_SITES = [
    "sudact.ru",
    "kad.arbitr.ru",
    "sudrf.ru",
    "ras.arbitr.ru",
    "vsrf.ru",
    "ipc.arbitr.ru",
]

# Паттерны определения типа дела
PATTERN_ARBITR  = re.compile(r"[АA]\d{2}-\d+/\d{2,4}", re.IGNORECASE)
PATTERN_CIVIL   = re.compile(r"\b(2-|М-|33-|44-)\d+/\d{2,4}")
PATTERN_VS      = re.compile(r"\d+-[А-ЯA-Z]{2}\d{2}-\d+")
PATTERN_IP      = re.compile(r"СИП-\d+/\d{4}", re.IGNORECASE)


def _detect_site(query: str) -> str:
    """Определяет приоритетный сайт по типу запроса."""
    q = query.strip()
    if PATTERN_IP.search(q):
        return "ipc.arbitr.ru"
    if PATTERN_VS.search(q):
        return "vsrf.ru"
    if PATTERN_ARBITR.search(q):
        return "kad.arbitr.ru"
    if PATTERN_CIVIL.search(q):
        return "sudact.ru"
    # По ключевым словам
    q_lower = q.lower()
    if any(w in q_lower for w in ["верховный суд", "вс рф", "кассационное определение вс"]):
        return "vsrf.ru"
    if any(w in q_lower for w in ["арбитраж", "арбитражный", "банкротство юридического"]):
        return "kad.arbitr.ru"
    if any(w in q_lower for w in ["товарный знак", "патент", "авторское право", "интеллектуальн"]):
        return "ipc.arbitr.ru"
    # По умолчанию — sudact.ru (агрегатор всех судов)
    return "sudact.ru"


def _yandex_search(query: str, folder_id: str, api_key: str, max_results: int = 10) -> list:
    """Выполняет поиск через Yandex Search API v2 (Yandex Cloud gateway, XML)."""
    # v2 endpoint — обязателен для новых ключей
    url = "https://searchapi.api.cloud.yandex.net/v2/web/searchAsync"

    # Для v2 используем JSON + Authorization header
    payload = json.dumps({
        "query": {
            "searchType": "SEARCH_TYPE_RU",
            "queryText": query,
            "familyMode": "FAMILY_MODE_NONE",
            "page": "0",
        },
        "sortSpec": {
            "sortMode": "SORT_MODE_BY_RELEVANCE",
        },
        "groupSpec": {
            "groupMode": "GROUP_MODE_DEEP",
            "groupsOnPage": str(min(max_results, 10)),
            "docsInGroup": "1",
        },
        "maxPassages": "3",
        "folderId": folder_id,
    }, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Api-Key {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Yandex Search HTTP {e.code}: {err_body[:400]}")

    # v2 возвращает operationId для асинхронного запроса — получаем результат
    operation_id = resp_data.get("id") or resp_data.get("operationId", "")
    if not operation_id:
        # Если вернулся сразу результат (синхронный режим)
        return _parse_v2_response(resp_data)

    # Polling операции (до 10 попыток)
    import time
    op_url = f"https://operation.api.cloud.yandex.net/operations/{operation_id}"
    for _ in range(10):
        time.sleep(1.5)
        op_req = urllib.request.Request(
            op_url,
            headers={"Authorization": f"Api-Key {api_key}"},
        )
        try:
            with urllib.request.urlopen(op_req, timeout=10) as op_resp:
                op_data = json.loads(op_resp.read().decode("utf-8"))
        except Exception:
            continue
        if op_data.get("done"):
            return _parse_v2_response(op_data.get("response", {}))

    raise RuntimeError("Yandex Search: операция не завершилась за отведённое время")


def _parse_v2_response(data: dict) -> list:
    """Парсит JSON-ответ Yandex Search API v2."""
    results = []
    # Ответ может содержать rawData (XML) или структурированные данные
    raw = data.get("rawData") or data.get("xmlData", "")
    if raw:
        import base64
        try:
            xml = base64.b64decode(raw).decode("utf-8")
            return _parse_xml_results(xml)
        except Exception:
            pass

    # Структурированный ответ
    groups = (data.get("result") or {}).get("grouping") or []
    for grp in groups:
        for doc in (grp.get("group") or []):
            for d in (doc.get("document") or []):
                url_val = d.get("url", "")
                title   = d.get("title", "")
                passages = [p.get("text", "") for p in (d.get("passages") or [])]
                headline = d.get("headline", "")
                snippet  = " ".join(passages) or headline
                snippet  = re.sub(r"<[^>]+>", "", snippet).strip()
                if url_val:
                    source = next((s for s in LEGAL_SITES if s in url_val), "")
                    results.append({"url": url_val, "title": re.sub(r"<[^>]+>", "", title).strip(), "snippet": snippet[:500], "source": source})
    return results


def _parse_xml_results(xml: str) -> list:
    """Парсит XML-ответ Yandex Search API."""
    results = []

    # Извлекаем блоки <doc>
    docs = re.findall(r"<doc>(.*?)</doc>", xml, re.DOTALL)

    for doc in docs:
        def _tag(name: str) -> str:
            m = re.search(rf"<{name}[^>]*>(.*?)</{name}>", doc, re.DOTALL)
            return re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else ""

        url_val     = _tag("url")
        title       = _tag("title")
        headline    = _tag("headline")
        passages    = re.findall(r"<passage>(.*?)</passage>", doc, re.DOTALL)
        snippet     = " ".join(re.sub(r"<[^>]+>", "", p).strip() for p in passages) or headline

        if not url_val:
            continue

        # Определяем источник
        source = next((s for s in LEGAL_SITES if s in url_val), "")

        results.append({
            "url":     url_val,
            "title":   title,
            "snippet": snippet[:500],
            "source":  source,
        })

    return results


def _err(code: int, msg: str) -> dict:
    return {
        "statusCode": code,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({"error": msg}, ensure_ascii=False),
    }


def _ok(data: dict) -> dict:
    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(data, ensure_ascii=False),
    }


def handler(event: dict, context) -> dict:
    """Поиск судебной практики через Yandex Search API. Возвращает список реальных ссылок на судебные акты."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if event.get("httpMethod") == "GET":
        return _ok({"ok": True, "service": "web-search"})

    body: dict = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            return _err(400, "Невалидный JSON")

    query      = (body.get("query") or "").strip()
    site_hint  = (body.get("site") or "").strip()   # опциональный явный сайт
    max_res    = min(int(body.get("limit", 8)), 20)

    if not query:
        return _err(400, "Укажите поисковый запрос")

    folder_id = os.environ.get("YANDEX_FOLDER_ID", "").strip()
    # Пробуем сначала выделенный ключ поиска, fallback — общий ключ YandexGPT
    api_key   = (os.environ.get("YANDEX_SEARCH_API_KEY") or os.environ.get("YANDEX_IAM_TOKEN") or "").strip()

    if not folder_id or not api_key:
        return _err(503, "Yandex Search API не настроен. Добавьте YANDEX_FOLDER_ID и YANDEX_SEARCH_API_KEY в секреты.")

    # Определяем целевой сайт
    target_site = site_hint if site_hint in LEGAL_SITES else _detect_site(query)

    # Формируем поисковый запрос с ограничением по сайту
    search_query = f"site:{target_site} {query}"

    print(f"[WEB_SEARCH] query={search_query!r} max={max_res}")

    try:
        results = _yandex_search(search_query, folder_id, api_key, max_results=max_res)
    except RuntimeError as e:
        print(f"[WEB_SEARCH] ERROR: {e}")
        return _err(502, f"Ошибка поиска: {e}")

    # Если первый сайт не дал результатов — пробуем sudact.ru как fallback
    if not results and target_site != "sudact.ru":
        fallback_query = f"site:sudact.ru {query}"
        print(f"[WEB_SEARCH] fallback query={fallback_query!r}")
        try:
            results = _yandex_search(fallback_query, folder_id, api_key, max_results=max_res)
            if results:
                target_site = "sudact.ru"
        except RuntimeError:
            pass

    return _ok({
        "results":      results,
        "total":        len(results),
        "query_used":   search_query,
        "target_site":  target_site,
    })