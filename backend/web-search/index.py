"""Поиск судебной практики через Yandex Search API v2. Требует YANDEX_SEARCH_API_KEY и YANDEX_FOLDER_ID. v4.1"""
import json
import os
import re
import time
import urllib.request
import urllib.parse
import urllib.error

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

LEGAL_SITES = [
    "sudact.ru",
    "kad.arbitr.ru",
    "sudrf.ru",
    "ras.arbitr.ru",
    "vsrf.ru",
    "ipc.arbitr.ru",
]

# Yandex Search API v2: жёсткий лимит на queryText — 400 символов.
# Оставляем запас под префикс "site:xxx.ru " (до ~20 символов).
MAX_QUERY_CHARS = 380

PATTERN_ARBITR = re.compile(r"[АA]\d{2}-\d+/\d{2,4}", re.IGNORECASE)
PATTERN_CIVIL  = re.compile(r"\b(2-|М-|33-|44-)\d+/\d{2,4}")
PATTERN_VS     = re.compile(r"\d+-[А-ЯA-Z]{2}\d{2}-\d+")
PATTERN_IP     = re.compile(r"СИП-\d+/\d{4}", re.IGNORECASE)


def _detect_site(query: str) -> str:
    q = query.strip()
    if PATTERN_IP.search(q):
        return "ipc.arbitr.ru"
    if PATTERN_VS.search(q):
        return "vsrf.ru"
    if PATTERN_ARBITR.search(q):
        return "kad.arbitr.ru"
    if PATTERN_CIVIL.search(q):
        return "sudact.ru"
    q_lower = q.lower()
    if any(w in q_lower for w in ["верховный суд", "вс рф"]):
        return "vsrf.ru"
    if any(w in q_lower for w in ["арбитраж", "арбитражный", "банкротство юридического"]):
        return "kad.arbitr.ru"
    if any(w in q_lower for w in ["товарный знак", "патент", "интеллектуальн"]):
        return "ipc.arbitr.ru"
    return "sudact.ru"


def _http_post(url: str, payload: dict, api_key: str, timeout: int = 15) -> dict:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url, data=data,
        headers={"Authorization": f"Api-Key {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body[:300]}")


def _http_get(url: str, api_key: str, timeout: int = 10) -> dict:
    req = urllib.request.Request(url, headers={"Authorization": f"Api-Key {api_key}"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body[:200]}")


def _parse_xml_results(xml: str) -> list:
    results = []

    def _tag_from(text: str, name: str) -> str:
        m = re.search(rf"<{name}[^>]*>(.*?)</{name}>", text, re.DOTALL)
        return re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else ""

    # Пробуем оба варианта тегов: <doc> (старый) и <document> (новый v2)
    doc_blocks = re.findall(r"<doc>(.*?)</doc>", xml, re.DOTALL)
    if not doc_blocks:
        doc_blocks = re.findall(r"<document>(.*?)</document>", xml, re.DOTALL)

    print(f"[WEB_SEARCH] found {len(doc_blocks)} doc blocks in XML")

    for doc in doc_blocks:
        url_val  = _tag_from(doc, "url")
        title    = _tag_from(doc, "title")
        passages = re.findall(r"<passage>(.*?)</passage>", doc, re.DOTALL)
        snippet  = " ".join(re.sub(r"<[^>]+>", "", p).strip() for p in passages) or _tag_from(doc, "headline")
        if not url_val:
            continue
        source = next((s for s in LEGAL_SITES if s in url_val), "")
        results.append({"url": url_val, "title": title, "snippet": snippet[:500], "source": source})

    # Если блоков нет — ищем <group> обёртки
    if not results:
        groups = re.findall(r"<group>(.*?)</group>", xml, re.DOTALL)
        print(f"[WEB_SEARCH] found {len(groups)} group blocks")
        for grp in groups:
            url_val  = _tag_from(grp, "url")
            title    = _tag_from(grp, "title")
            passages = re.findall(r"<passage>(.*?)</passage>", grp, re.DOTALL)
            snippet  = " ".join(re.sub(r"<[^>]+>", "", p).strip() for p in passages) or _tag_from(grp, "headline")
            if not url_val:
                continue
            source = next((s for s in LEGAL_SITES if s in url_val), "")
            results.append({"url": url_val, "title": title, "snippet": snippet[:500], "source": source})

    return results


def _extract_results(data: dict) -> list:
    """Извлекает результаты из ответа операции."""
    import base64

    # Вариант 1: rawData / xmlData — может быть base64 или plain XML
    for key in ("rawData", "xmlData", "data"):
        raw = data.get(key)
        if not raw or not isinstance(raw, str):
            continue
        # Пробуем как plain XML сначала
        if raw.strip().startswith("<?xml") or raw.strip().startswith("<yandex"):
            r = _parse_xml_results(raw)
            if r:
                print(f"[WEB_SEARCH] {len(r)} results from plain XML ({key})")
                return r
        # Пробуем как base64
        try:
            xml = base64.b64decode(raw).decode("utf-8")
            print(f"[WEB_SEARCH] decoded base64 {key}, first 80: {xml[:80]!r}")
            r = _parse_xml_results(xml)
            if r:
                print(f"[WEB_SEARCH] {len(r)} results from base64 XML ({key})")
                return r
            # Если XML распарсился но пустой — покажем начало для отладки
            print(f"[WEB_SEARCH] XML parsed but 0 docs. XML[:300]={xml[:300]!r}")
        except Exception as e:
            print(f"[WEB_SEARCH] not base64 ({key}): {e}. raw[:80]={raw[:80]!r}")

    # Вариант 2: структурированный grouping
    results = []
    grouping = (data.get("result") or data).get("grouping") or []
    for grp in grouping:
        for group in (grp.get("group") or []):
            for doc in (group.get("document") or []):
                url_val = doc.get("url", "")
                title   = re.sub(r"<[^>]+>", "", doc.get("title", "")).strip()
                passages = [re.sub(r"<[^>]+>", "", p.get("text", "")) for p in (doc.get("passages") or [])]
                snippet  = " ".join(passages).strip() or re.sub(r"<[^>]+>", "", doc.get("headline", "")).strip()
                if url_val:
                    source = next((s for s in LEGAL_SITES if s in url_val), "")
                    results.append({"url": url_val, "title": title, "snippet": snippet[:500], "source": source})

    print(f"[WEB_SEARCH] {len(results)} results from structured. data keys={list(data.keys())[:8]}")
    return results


def _do_search(query: str, folder_id: str, api_key: str, max_results: int = 8) -> list:
    """Запускает поиск через Yandex Search API v2 (async polling)."""
    payload = {
        "query": {
            "searchType": "SEARCH_TYPE_RU",
            "queryText": query,
            "familyMode": "FAMILY_MODE_NONE",
            "page": "0",
        },
        "sortSpec": {"sortMode": "SORT_MODE_BY_RELEVANCE"},
        "groupSpec": {
            "groupMode": "GROUP_MODE_DEEP",
            "groupsOnPage": str(min(max_results, 10)),
            "docsInGroup": "1",
        },
        "maxPassages": "3",
        "folderId": folder_id,
    }

    resp = _http_post(
        "https://searchapi.api.cloud.yandex.net/v2/web/searchAsync",
        payload, api_key, timeout=15,
    )
    print(f"[WEB_SEARCH] searchAsync keys={list(resp.keys())}")

    op_id = resp.get("id") or resp.get("operationId", "")
    if not op_id:
        return _extract_results(resp)

    op_url = f"https://operation.api.cloud.yandex.net/operations/{op_id}"
    for attempt in range(12):
        time.sleep(1.5)
        op = _http_get(op_url, api_key, timeout=10)
        print(f"[WEB_SEARCH] poll {attempt+1} done={op.get('done')} keys={list(op.keys())[:5]}")
        if op.get("done"):
            resp_data = op.get("response") or op.get("result") or {}
            print(f"[WEB_SEARCH] response keys={list(resp_data.keys())} rawData[:100]={str(resp_data.get('rawData',''))[:100]!r}")
            return _extract_results(resp_data)

    raise RuntimeError("Timeout: операция не завершилась за 18 секунд")


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
    """Поиск судебной практики через Yandex Search API v2."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    if event.get("httpMethod") == "GET":
        return _ok({"ok": True, "service": "web-search", "version": "4"})

    body: dict = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            return _err(400, "Невалидный JSON")

    query     = (body.get("query") or "").strip()[:MAX_QUERY_CHARS]
    site_hint = (body.get("site") or "").strip()
    max_res   = min(int(body.get("limit", 8)), 10)

    if not query:
        return _err(400, "Укажите поисковый запрос")

    folder_id = os.environ.get("YANDEX_FOLDER_ID", "").strip()
    api_key   = os.environ.get("YANDEX_SEARCH_API_KEY", "").strip()

    if not folder_id or not api_key:
        return _err(503, "Добавьте секреты YANDEX_FOLDER_ID и YANDEX_SEARCH_API_KEY")

    target_site  = site_hint if site_hint in LEGAL_SITES else _detect_site(query)
    search_query = f"site:{target_site} {query}"
    print(f"[WEB_SEARCH] query={search_query!r} folder={folder_id[:8]}...")

    try:
        results = _do_search(search_query, folder_id, api_key, max_results=max_res)
    except RuntimeError as e:
        print(f"[WEB_SEARCH] ERROR: {e}")
        # Retry без site:
        try:
            results = _do_search(query, folder_id, api_key, max_results=max_res)
            print(f"[WEB_SEARCH] retry without site: {len(results)} results")
        except RuntimeError as e2:
            return _err(502, f"Ошибка поиска: {e}")

    # Fallback на sudact если нет результатов с другого сайта
    if not results and target_site != "sudact.ru":
        try:
            results = _do_search(f"site:sudact.ru {query}", folder_id, api_key, max_results=max_res)
            if results:
                target_site = "sudact.ru"
        except RuntimeError:
            pass

    return _ok({"results": results, "total": len(results), "target_site": target_site})