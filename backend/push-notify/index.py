"""Отправка Web Push уведомлений. Вызывается внутренне из других функций."""
import json
import os
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")
ADMIN_EMAIL = "ilya.povarchuk@mail.ru"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Internal-Secret",
}


def get_conn():
    return psycopg2.connect(
        os.environ["DATABASE_URL"],
        connect_timeout=3,
        options="-c statement_timeout=5000",
    )


def _send_push_to_subscription(sub: dict, title: str, body: str, url: str, tag: str) -> bool:
    try:
        from pywebpush import webpush
        vapid_private = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
        if not vapid_private:
            return False
        webpush(
            subscription_info={
                "endpoint": sub["endpoint"],
                "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
            },
            data=json.dumps({"title": title, "body": body, "url": url, "tag": tag}),
            vapid_private_key=vapid_private,
            vapid_claims={"sub": f"mailto:{ADMIN_EMAIL}"},
            timeout=4,
        )
        return True
    except Exception as e:
        print(f"[PUSH] Ошибка: {e}")
        return False


def push_to_admin(title: str, body: str, url: str, tag: str):
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT id, endpoint, p256dh, auth FROM {SCHEMA}.push_subscriptions ps "
            f"JOIN {SCHEMA}.users u ON u.id = ps.user_id WHERE u.is_admin = TRUE AND ps.auth != 'expired'"
        )
        rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    for row in rows:
        _send_push_to_subscription(
            {"endpoint": row[1], "p256dh": row[2], "auth": row[3]},
            title, body, url, tag,
        )


def push_to_users(user_ids: list, title: str, body: str, url: str, tag: str):
    if not user_ids:
        return
    conn = get_conn()
    cur = conn.cursor()
    try:
        placeholders = ",".join(["%s"] * len(user_ids))
        cur.execute(
            f"SELECT DISTINCT ON (user_id) id, endpoint, p256dh, auth "
            f"FROM {SCHEMA}.push_subscriptions "
            f"WHERE user_id IN ({placeholders}) AND auth != 'expired' "
            f"ORDER BY user_id, id DESC",
            user_ids,
        )
        rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    expired = []
    for row in rows:
        sub_id, endpoint, p256dh, auth = row
        ok = _send_push_to_subscription(
            {"endpoint": endpoint, "p256dh": p256dh, "auth": auth},
            title, body, url, tag,
        )
        if not ok:
            expired.append(sub_id)

    if expired:
        try:
            conn2 = get_conn()
            cur2 = conn2.cursor()
            placeholders2 = ",".join(["%s"] * len(expired))
            cur2.execute(
                f"UPDATE {SCHEMA}.push_subscriptions SET auth = 'expired' WHERE id IN ({placeholders2})",
                expired,
            )
            conn2.commit()
            cur2.close()
            conn2.close()
        except Exception:
            pass


def handler(event: dict, context) -> dict:
    """Push-notify: внутренний сервис отправки Web Push уведомлений."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    push_type = body.get("type")  # "admin" | "users"
    title = body.get("title", "")
    msg = body.get("body", "")
    url = body.get("url", "/cabinet")
    tag = body.get("tag", "ii-pravo")

    def _resp(status: int, data: dict) -> dict:
        return {
            "statusCode": status,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False),
        }

    if not push_type or not title:
        return _resp(400, {"error": "type и title обязательны"})

    if push_type == "admin":
        push_to_admin(title, msg, url, tag)
        return _resp(200, {"ok": True})

    if push_type == "users":
        user_ids = body.get("user_ids", [])
        if not user_ids:
            return _resp(400, {"error": "user_ids обязателен для type=users"})
        push_to_users(user_ids, title, msg, url, tag)
        return _resp(200, {"ok": True})

    return _resp(400, {"error": "Неизвестный type"})
