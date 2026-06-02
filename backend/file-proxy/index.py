import json
import base64
import os
from urllib.parse import urlparse, unquote

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-Authorization",
}

CDN_HOST = "cdn.poehali.dev"


def handler(event: dict, context) -> dict:
    """Прокси для скачивания файлов из S3 — обходит CORS-ограничения браузера."""
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
    parsed = urlparse(file_url)
    if parsed.hostname != CDN_HOST:
        return {
            "statusCode": 403,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": "forbidden host"}),
        }

    # CDN путь: /projects/{project_id}/bucket/{key...}
    # Извлекаем S3 ключ — всё после /bucket/
    path = unquote(parsed.path)
    bucket_marker = "/bucket/"
    idx = path.find(bucket_marker)
    if idx == -1:
        return {
            "statusCode": 400,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": "invalid cdn url"}),
        }

    s3_key = path[idx + len(bucket_marker):]
    filename = s3_key.split("/")[-1]

    # Скачиваем из S3 напрямую
    import boto3
    s3 = boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )

    # MIME-map для корректного скачивания на iOS
    MIME_MAP = {
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc":  "application/msword",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xls":  "application/vnd.ms-excel",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "ppt":  "application/vnd.ms-powerpoint",
        "pdf":  "application/pdf",
    }

    try:
        resp = s3.get_object(Bucket="files", Key=s3_key)
        data = resp["Body"].read()
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        content_type = MIME_MAP.get(ext) or resp.get("ContentType") or "application/octet-stream"
    except Exception as e:
        return {
            "statusCode": 502,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": str(e), "key": s3_key}),
        }

    encoded = base64.b64encode(data).decode("utf-8")

    # Кодируем имя файла для Content-Disposition (RFC 5987)
    from urllib.parse import quote
    encoded_name = quote(filename, safe="")

    return {
        "statusCode": 200,
        "headers": {
            **CORS,
            "Content-Type": content_type,
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_name}",
        },
        "body": encoded,
        "isBase64Encoded": True,
    }