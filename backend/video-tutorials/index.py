"""
Управление видео-инструкциями: список, создание, редактирование, удаление, загрузка видео.
Публичный эндпоинт для списка (GET). Админские — требуют X-Auth-Token.
Видео до 20 МБ загружается НАПРЯМУЮ в S3 из браузера через presigned URL
(get_upload_url отдаёт ссылку, дальше PUT идёт мимо тела этой функции) —
так обходим лимит на размер payload cloud-функции.
"""
import json
import os
import time
import psycopg2
import boto3

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=8)


def get_admin_user(token: str):
    if not token:
        return None
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT u.id, u.is_admin FROM {SCHEMA}.users u
                JOIN {SCHEMA}.sessions s ON s.user_id = u.id
                WHERE s.token = %s AND s.expires_at > NOW()""",
            (token,)
        )
        row = cur.fetchone()
        if row and row[1]:
            return {"id": row[0]}
        return None
    finally:
        cur.close()
        conn.close()


ALLOWED_VIDEO_EXTS = {"mp4", "webm", "mov", "avi", "mkv", "m4v"}
VIDEO_CONTENT_TYPES = {
    "mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime",
    "avi": "video/x-msvideo", "mkv": "video/x-matroska", "m4v": "video/mp4",
}


def get_s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def create_upload_url(filename: str, is_welcome: bool = False) -> dict:
    """
    Генерирует presigned URL для ПРЯМОЙ загрузки видео с браузера в S3 (PUT),
    минуя тело cloud-функции — видео до 20 МБ в base64 (~27 МБ) не проходит
    через лимит на размер payload функции, поэтому файл льётся напрямую в S3.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "mp4"
    if ext not in ALLOWED_VIDEO_EXTS:
        raise ValueError(f"Недопустимый формат: {ext}. Допустимые: mp4, webm, mov")
    content_type = VIDEO_CONTENT_TYPES.get(ext, "video/mp4")

    folder = "welcome" if is_welcome else "tutorials"
    key = f"{folder}/{int(time.time())}_{filename.replace(' ', '_')}"
    s3 = get_s3()
    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": "files", "Key": key, "ContentType": content_type},
        ExpiresIn=600,
    )
    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
    return {"upload_url": upload_url, "cdn_url": cdn_url, "content_type": content_type}


def handler(event: dict, context) -> dict:
    """Видео-инструкции: список, создание/редактирование/удаление (только admin), загрузка видео."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": {**CORS}, "body": ""}

    token = (event.get("headers") or {}).get("X-Auth-Token", "").strip()
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    action = body.get("action", "list")
    method = event.get("httpMethod", "GET")

    # ── Публичный список (без авторизации) ──────────────────────────────────
    if method == "GET" or action == "list":
        conn = get_conn()
        cur = conn.cursor()
        try:
            cur.execute(
                f"""SELECT id, title, description, video_url, sort_order, is_welcome
                    FROM {SCHEMA}.video_tutorials
                    WHERE is_active = TRUE
                    ORDER BY is_welcome DESC, sort_order ASC, id ASC"""
            )
            rows = cur.fetchall()
            welcome_video = None
            tutorials = []
            for r in rows:
                item = {
                    "id": r[0], "title": r[1], "description": r[2] or "",
                    "video_url": r[3] or "", "sort_order": r[4], "is_welcome": r[5]
                }
                if r[5]:
                    welcome_video = item
                else:
                    tutorials.append(item)
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"welcome_video": welcome_video, "tutorials": tutorials}, ensure_ascii=False)}
        finally:
            cur.close()
            conn.close()

    # ── Все остальные действия — только для администратора ───────────────────
    admin = get_admin_user(token)
    if not admin:
        return {"statusCode": 403, "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"error": "Доступ запрещён"}, ensure_ascii=False)}

    # ── Получить presigned URL для прямой загрузки видео в S3 из браузера ────
    if action == "get_upload_url":
        filename = body.get("filename", "video.mp4")
        is_welcome = bool(body.get("is_welcome", False))
        try:
            result = create_upload_url(filename, is_welcome)
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps(result, ensure_ascii=False)}
        except ValueError as e:
            return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"error": str(e)}, ensure_ascii=False)}

    # ── Установить приветственное видео (только одно) ───────────────────────
    if action == "set_welcome":
        video_url = (body.get("video_url") or "").strip()
        title = (body.get("title") or "Добро пожаловать!").strip()[:200]
        conn = get_conn()
        cur = conn.cursor()
        try:
            # Сбрасываем флаг у всех
            cur.execute(f"UPDATE {SCHEMA}.video_tutorials SET is_welcome = FALSE WHERE is_welcome = TRUE")
            if video_url:
                # Проверяем, есть ли уже запись welcome
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.video_tutorials WHERE is_welcome = TRUE LIMIT 1"
                )
                existing = cur.fetchone()
                if existing:
                    cur.execute(
                        f"""UPDATE {SCHEMA}.video_tutorials
                            SET video_url = %s, title = %s, is_welcome = TRUE, is_active = TRUE, updated_at = NOW()
                            WHERE id = %s""",
                        (video_url, title, existing[0])
                    )
                else:
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.video_tutorials (title, video_url, is_welcome, sort_order, is_active)
                            VALUES (%s, %s, TRUE, 0, TRUE)""",
                        (title, video_url)
                    )
            conn.commit()
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"ok": True}, ensure_ascii=False)}
        finally:
            cur.close()
            conn.close()

    # ── Создать обучающий ролик ──────────────────────────────────────────────
    if action == "create":
        title = (body.get("title") or "").strip()[:200]
        description = (body.get("description") or "").strip()
        video_url = (body.get("video_url") or "").strip()
        sort_order = int(body.get("sort_order", 99))
        if not title:
            return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"error": "Заголовок обязателен"}, ensure_ascii=False)}
        conn = get_conn()
        cur = conn.cursor()
        try:
            cur.execute(
                f"""INSERT INTO {SCHEMA}.video_tutorials (title, description, video_url, sort_order, is_welcome)
                    VALUES (%s, %s, %s, %s, FALSE) RETURNING id""",
                (title, description or None, video_url or None, sort_order)
            )
            new_id = cur.fetchone()[0]
            conn.commit()
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"ok": True, "id": new_id}, ensure_ascii=False)}
        finally:
            cur.close()
            conn.close()

    # ── Обновить блок ───────────────────────────────────────────────────────
    if action == "update":
        tut_id = int(body.get("id", 0))
        if not tut_id:
            return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"error": "id обязателен"}, ensure_ascii=False)}
        fields = []
        params = []
        if "title" in body:
            fields.append("title = %s"); params.append((body["title"] or "")[:200])
        if "description" in body:
            fields.append("description = %s"); params.append(body["description"] or None)
        if "video_url" in body:
            fields.append("video_url = %s"); params.append(body["video_url"] or None)
        if "sort_order" in body:
            fields.append("sort_order = %s"); params.append(int(body["sort_order"]))
        if "is_active" in body:
            fields.append("is_active = %s"); params.append(bool(body["is_active"]))
        if not fields:
            return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"error": "Нет полей для обновления"}, ensure_ascii=False)}
        params.append(tut_id)
        conn = get_conn()
        cur = conn.cursor()
        try:
            cur.execute(
                f"UPDATE {SCHEMA}.video_tutorials SET {', '.join(fields)}, updated_at = NOW() WHERE id = %s",
                params
            )
            conn.commit()
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"ok": True}, ensure_ascii=False)}
        finally:
            cur.close()
            conn.close()

    # ── Удалить блок ────────────────────────────────────────────────────────
    if action == "delete":
        tut_id = int(body.get("id", 0))
        if not tut_id:
            return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"error": "id обязателен"}, ensure_ascii=False)}
        conn = get_conn()
        cur = conn.cursor()
        try:
            cur.execute(f"DELETE FROM {SCHEMA}.video_tutorials WHERE id = %s", (tut_id,))
            conn.commit()
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"ok": True}, ensure_ascii=False)}
        finally:
            cur.close()
            conn.close()

    # ── Список всех (включая неактивные) — для админки ─────────────────────
    if action == "list_all":
        conn = get_conn()
        cur = conn.cursor()
        try:
            cur.execute(
                f"""SELECT id, title, description, video_url, sort_order, is_active, is_welcome
                    FROM {SCHEMA}.video_tutorials
                    ORDER BY is_welcome DESC, sort_order ASC, id ASC"""
            )
            rows = cur.fetchall()
            tutorials = [
                {"id": r[0], "title": r[1], "description": r[2] or "", "video_url": r[3] or "",
                 "sort_order": r[4], "is_active": r[5], "is_welcome": r[6]}
                for r in rows
            ]
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"tutorials": tutorials}, ensure_ascii=False)}
        finally:
            cur.close()
            conn.close()

    return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": "Неизвестное действие"}, ensure_ascii=False)}