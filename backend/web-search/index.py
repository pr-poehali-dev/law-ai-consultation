"""Поиск судебной практики через бесплатный Яндекс XML-поиск. v3"""
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

LEGAL_SITES = [
    "sudact.ru",
    "kad.arbitr.ru",
    "sudrf.ru",
    "ras.arbitr.ru",
    "vsrf.ru",
    "ipc.arbitr.ru",
]

PATTERN_ARBITR = re.compile(r"[АA]\d{2}-\d+/\d{2,4}", re.IGNORECASE)
PATTERN_CIVIL  = re.compile(r"\b(2-|М-|33-|44-)\d+/\d{2,4}")
PATTERN_VS     = re.compile(r"\d+-[А-ЯA-Z]{2}\d{2}-\d+")
PATTERN_IP     = re.compile(r"СИП-\d+/\d{4}", re.IGNORECASE)

# User-Agent для запросов
UA = "Mozilla/5.0 (compatible; legal-search-bot/3.0)"


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


def _search_yandex_xml(query: str, max_results: int = 8) -> list:
    """
    Бесплатный Яндекс XML-поиск через публичный endpoint.
    Не требует ключей — работает как обычный веб-поиск.
    """
    params = {
        "text": query,
        "format": "json",
        "results": str(min(max_results, 10)),
        "lr": "225",   # Россия
        "lang": "ru",
    }
    url = "https://yandex.ru/search/xml?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/xml,text/xml,*/*",
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8")
        return _parse_xml(body)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}")
    except Exception as e:
        raise RuntimeError(str(e))


def _search_ddg(query: str, max_results: int = 8) -> list:
    """
    Fallback: DuckDuckGo HTML-поиск (бесплатный, без ключей).
    Парсим сниппеты из результатов.
    """
    params = {"q": query, "kl": "ru-ru", "kp": "-2"}
    url = "https://html.duckduckgo.com/html/?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept-Language": "ru-RU,ru;q=0.9",
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8")
    except Exception as e:
        raise RuntimeError(f"DDG error: {e}")

    results = []
    # Парсим блоки результатов из DDG HTML
    blocks = re.findall(r'class="result__body"(.*?)(?=class="result__body"|$)', html, re.DOTALL)
    for block in blocks[:max_results]:
        url_m = re.search(r'href="([^"]+)"', block)
        title_m = re.search(r'class="result__a"[^>]*>(.*?)</a>', block, re.DOTALL)
        snip_m  = re.search(r'class="result__snippet"[^>]*>(.*?)</(?:a|span|div)>', block, re.DOTALL)
        if not url_m:
            continue
        raw_url = url_m.group(1)
        # DDG иногда оборачивает URL
        if raw_url.startswith("//duckduckgo.com/l/?"):
            uddg = re.search(r"uddg=([^&]+)", raw_url)
            if uddg:
                raw_url = urllib.parse.unquote(uddg.group(1))
        title   = re.sub(r"<[^>]+>", "", title_m.group(1)).strip() if title_m else raw_url
        snippet = re.sub(r"<[^>]+>", "", snip_m.group(1)).strip()  if snip_m  else ""
        source  = next((s for s in LEGAL_SITES if s in raw_url), "")
        results.append({"url": raw_url, "title": title, "snippet": snippet[:500], "source": source})

    return results


def _parse_xml(xml: str) -> list:
    """Парсит XML-ответ Яндекса."""
    results = []
    docs = re.findall(r"<doc>(.*?)</doc>", xml, re.DOTALL)
    for doc in docs:
        def _tag(name: str) -> str:
            m = re.search(rf"<{name}[^>]*>(.*?)</{name}>", doc, re.DOTALL)
            return re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else ""
        url_val  = _tag("url")
        title    = _tag("title")
        passages = re.findall(r"<passage>(.*?)</passage>", doc, re.DOTALL)
        snippet  = " ".join(re.sub(r"<[^>]+>", "", p).strip() for p in passages) or _tag("headline")
        if not url_val:
            continue
        source = next((s for s in LEGAL_SITES if s in url_val), "")
        results.append({"url": url_val, "title": title, "snippet": snippet[:500], "source": source})
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
    """Поиск судебной практики через бесплатный Яндекс XML и DuckDuckGo. Ключи не нужны."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if event.get("httpMethod") == "GET":
        return _ok({"ok": True, "service": "web-search", "version": "3"})

    body: dict = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            return _err(400, "Невалидный JSON")

    query     = (body.get("query") or "").strip()
    site_hint = (body.get("site") or "").strip()
    max_res   = min(int(body.get("limit", 8)), 10)

    if not query:
        return _err(400, "Укажите поисковый запрос")

    target_site  = site_hint if site_hint in LEGAL_SITES else _detect_site(query)
    search_query = f"site:{target_site} {query}"

    print(f"[WEB_SEARCH_v3] query={search_query!r}")

    # ── Попытка 1: Яндекс XML ────────────────────────────────────
    results = []
    engine  = "yandex"
    try:
        results = _search_yandex_xml(search_query, max_results=max_res)
        print(f"[WEB_SEARCH_v3] yandex returned {len(results)} results")
    except RuntimeError as e:
        print(f"[WEB_SEARCH_v3] yandex failed: {e}, trying DDG fallback")

    # ── Попытка 2: DuckDuckGo fallback ───────────────────────────
    if not results:
        engine = "duckduckgo"
        try:
            results = _search_ddg(search_query, max_results=max_res)
            print(f"[WEB_SEARCH_v3] ddg returned {len(results)} results")
        except RuntimeError as e:
            print(f"[WEB_SEARCH_v3] ddg also failed: {e}")

    # ── Попытка 3: fallback на sudact.ru ─────────────────────────
    if not results and target_site != "sudact.ru":
        fallback_q = f"site:sudact.ru {query}"
        print(f"[WEB_SEARCH_v3] fallback to sudact: {fallback_q!r}")
        try:
            results = _search_yandex_xml(fallback_q, max_results=max_res)
            if results:
                target_site = "sudact.ru"
        except RuntimeError:
            pass
        if not results:
            try:
                results = _search_ddg(fallback_q, max_results=max_res)
                if results:
                    target_site = "sudact.ru"
                    engine = "duckduckgo"
            except RuntimeError:
                pass

    return _ok({
        "results":     results,
        "total":       len(results),
        "target_site": target_site,
        "engine":      engine,
    })
