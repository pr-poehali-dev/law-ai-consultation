"""
Загрузка файлов для юриста в S3. Отдельная функция с таймаутом 30с.
Таймаут lawyer-service (переписка) — 5с. Этой функции нужно 30с для ZIP до 20 МБ.
"""
import base64
import json
import os
import re
import time

import boto3
import psycopg2
from botocore.config import Config as BotoConfig

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

ALLOWED_EXTS = {"pdf", "docx", "doc", "jpg", "jpeg", "png", "txt", "zip"}

MIME_MAP = {
    "pdf":  "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc":  "application/msword",
    "jpg":  "image/jpeg",
    "jpeg": "image/jpeg",
    "png":  "image/png",
    "txt":  "text/plain",
    "zip":  "application/zip",
}


def _json(status: int, data: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(data, ensure_ascii=False),
    }


def _get_user_id(token: str) -> int | None:
    if not token or len(token) > 200:
        return None
    conn = psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=3,
                            options="-c statement_timeout=4000")
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT user_id FROM {SCHEMA}.sessions WHERE token = %s AND expires_at > NOW()",
            (token,)
        )
        row = cur.fetchone()
        return row[0] if row else None
    finally:
        cur.close()
        conn.close()


def handler(event: dict, context) -> dict:
    """Загрузка файла (до 20 МБ) в S3 для передачи юристу."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    # Авторизация
    headers = event.get("headers") or {}
    token = headers.get("X-Auth-Token") or headers.get("x-auth-token", "")
    user_id = _get_user_id(token)
    if not user_id:
        return _json(401, {"error": "Не авторизован"})

    # Тело запроса
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            return _json(400, {"error": "Некорректный JSON"})

    file_b64 = body.get("file", "")
    filename = re.sub(r'[\x00-\x1f]', '', str(body.get("filename", "document")))[:200].strip()

    if not file_b64:
        return _json(400, {"error": "Файл обязателен"})

    try:
        file_data = base64.b64decode(file_b64)
    except Exception:
        return _json(400, {"error": "Некорректный base64"})

    if len(file_data) > 6 * 1024 * 1024:
        return _json(400, {"error": "Файл слишком большой (макс. 6 МБ)"})

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    if ext not in ALLOWED_EXTS:
        return _json(400, {"error": f"Формат .{ext} не поддерживается"})

    content_type = MIME_MAP.get(ext, "application/octet-stream")
    ts = int(time.time())
    key = f"lawyer-files/{ts}_{user_id}_{filename}"

    s3 = boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        config=BotoConfig(connect_timeout=5, read_timeout=25),
    )
    s3.put_object(
        Bucket="files",
        Key=key,
        Body=file_data,
        ContentType=content_type,
        Metadata={"uploaded_at": str(ts), "user_id": str(user_id), "ttl": str(ts + 86400)},
    )

    project_id = os.environ["AWS_ACCESS_KEY_ID"]
    cdn_url = f"https://cdn.poehali.dev/projects/{project_id}/bucket/{key}"

    return _json(200, {"url": cdn_url, "key": key, "filename": filename, "expires_at": ts + 86400})