"""
Управление ставками госпошлины (ст. 333.19 и 333.21 НК РФ).
GET / — список всех ставок
GET /?history=1 — история изменений
POST / — обновить ставку (только для админа, X-Auth-Token)
"""
import json
import os
import psycopg2
from datetime import datetime

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=5)

def get_user_by_token(token: str):
    if not token:
        return None
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT u.id, u.email, u.is_admin
                FROM {SCHEMA}.sessions s
                JOIN {SCHEMA}.users u ON u.id = s.user_id
                WHERE s.token = %s AND s.expires_at > NOW()""",
            (token,)
        )
        row = cur.fetchone()
        if not row:
            return None
        return {"id": row[0], "email": row[1], "is_admin": bool(row[2])}
    finally:
        cur.close()
        conn.close()

def ok(data):
    return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False, default=str)}

def err(code, msg):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": msg}, ensure_ascii=False)}

def handler(event: dict, context) -> dict:
    """Ставки госпошлины — GET список, POST обновление (админ)."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}

    if method == "GET":
        if params.get("history"):
            return get_history()
        return get_rates()

    if method == "POST":
        token = (event.get("headers") or {}).get("X-Auth-Token", "")
        user = get_user_by_token(token)
        if not user or not user["is_admin"]:
            return err(403, "Доступ запрещён")
        body = json.loads(event.get("body") or "{}")
        return update_rate(body, user["email"])

    return err(405, "Method not allowed")


def get_rates():
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT id, court_type, sub_key, label, sub_ref,
                       amount_individual, amount_org, note, sort_order, updated_at, updated_by
                FROM {SCHEMA}.court_duty_rates
                WHERE is_active = TRUE
                ORDER BY court_type, sort_order""",
        )
        rows = cur.fetchall()
        rates = []
        for r in rows:
            rates.append({
                "id": r[0], "court_type": r[1], "sub_key": r[2],
                "label": r[3], "sub_ref": r[4],
                "amount_individual": r[5], "amount_org": r[6],
                "note": r[7], "sort_order": r[8],
                "updated_at": r[9].isoformat() if r[9] else None,
                "updated_by": r[10],
            })
        return ok({"rates": rates})
    finally:
        cur.close()
        conn.close()


def get_history():
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT h.id, h.rate_id, r.label, r.sub_ref, h.field_changed,
                       h.old_value, h.new_value, h.changed_by, h.changed_at
                FROM {SCHEMA}.court_duty_history h
                JOIN {SCHEMA}.court_duty_rates r ON r.id = h.rate_id
                ORDER BY h.changed_at DESC
                LIMIT 100""",
        )
        rows = cur.fetchall()
        history = []
        for r in rows:
            history.append({
                "id": r[0], "rate_id": r[1], "label": r[2], "sub_ref": r[3],
                "field_changed": r[4], "old_value": r[5], "new_value": r[6],
                "changed_by": r[7],
                "changed_at": r[8].isoformat() if r[8] else None,
            })
        return ok({"history": history})
    finally:
        cur.close()
        conn.close()


def update_rate(body: dict, admin_email: str):
    rate_id = body.get("id")
    if not rate_id:
        return err(400, "Укажите id ставки")

    allowed_fields = {"amount_individual", "amount_org", "note", "label"}
    updates = {k: v for k, v in body.items() if k in allowed_fields}
    if not updates:
        return err(400, "Нет полей для обновления")

    conn = get_conn()
    cur = conn.cursor()
    try:
        # Получаем текущие значения
        cur.execute(
            f"SELECT amount_individual, amount_org, note, label FROM {SCHEMA}.court_duty_rates WHERE id = %s",
            (rate_id,)
        )
        row = cur.fetchone()
        if not row:
            return err(404, "Ставка не найдена")
        old = {"amount_individual": row[0], "amount_org": row[1], "note": row[2], "label": row[3]}

        # Обновляем
        set_parts = ", ".join(f"{k} = %s" for k in updates)
        set_parts += ", updated_at = NOW(), updated_by = %s"
        vals = list(updates.values()) + [admin_email, rate_id]
        cur.execute(f"UPDATE {SCHEMA}.court_duty_rates SET {set_parts} WHERE id = %s", vals)

        # Пишем историю
        for field, new_val in updates.items():
            if str(old.get(field)) != str(new_val):
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.court_duty_history
                        (rate_id, field_changed, old_value, new_value, changed_by)
                        VALUES (%s, %s, %s, %s, %s)""",
                    (rate_id, field, str(old.get(field)), str(new_val), admin_email)
                )

        conn.commit()
        return ok({"ok": True})
    finally:
        cur.close()
        conn.close()
