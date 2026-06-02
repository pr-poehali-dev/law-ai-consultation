import json
import urllib.request
import urllib.error
import base64
import os

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-Authorization",
}

ALLOWED_HOST = "cdn.poehali.dev"


def handler(event: dict, context) -> dict:
    """Прокси для скачивания файлов с CDN — обходит CORS-ограничения браузера."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    params = event.get("queryStringParameters") or {}
    file_url = params.get("url", "").strip()

    if not file_url:
        return {
            "statusCode": 400,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": "url required"}),
        }

    # Безопасность: разрешаем только наш CDN
    from urllib.parse import urlparse
    parsed = urlparse(file_url)
    if parsed.hostname != ALLOWED_HOST:
        return {
            "statusCode": 403,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": "forbidden host"}),
        }

    try:
        req = urllib.request.Request(file_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            content_type = resp.headers.get("Content-Type", "application/octet-stream")
    except urllib.error.HTTPError as e:
        return {
            "statusCode": e.code,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": f"upstream {e.code}"}),
        }
    except Exception as e:
        return {
            "statusCode": 502,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)}),
        }

    filename = file_url.split("/")[-1]
    encoded = base64.b64encode(data).decode("utf-8")

    return {
        "statusCode": 200,
        "headers": {
            **CORS,
            "Content-Type": content_type,
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
        "body": encoded,
        "isBase64Encoded": True,
    }
