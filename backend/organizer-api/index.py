"""Юридический органайзер: управление делами, заседаниями, задачами и документами."""
import json
import os
import psycopg2
from datetime import date, datetime

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}


def get_conn():
    return psycopg2.connect(
        os.environ["DATABASE_URL"],
        connect_timeout=8,
        options="-c statement_timeout=15000",
    )


def json_serial(obj):
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def resp(status, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, default=json_serial),
    }


def get_user_id(headers, conn):
    token = (headers or {}).get("X-Auth-Token") or (headers or {}).get("x-auth-token", "")
    if not token:
        return None
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT user_id FROM {SCHEMA}.sessions WHERE token = %s AND expires_at > NOW()",
            (token,)
        )
        row = cur.fetchone()
    return row[0] if row else None


def has_active_plan(user_id, conn):
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT purchased_plan, paid_requests FROM {SCHEMA}.users WHERE id = %s",
            (user_id,)
        )
        row = cur.fetchone()
    if not row:
        return False
    purchased_plan, paid_r = row
    return purchased_plan is not None or (paid_r or 0) > 0


def handler(event: dict, context) -> dict:
    """Органайзер: CRUD через action-поле в body."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if event.get("httpMethod") == "GET":
        return resp(200, {"ok": True, "service": "organizer-api"})

    conn = get_conn()
    try:
        headers = event.get("headers") or {}
        user_id = get_user_id(headers, conn)
        if not user_id:
            return resp(401, {"error": "Unauthorized"})

        if not has_active_plan(user_id, conn):
            return resp(403, {"error": "Требуется активный тариф «Старт» или выше"})

        body = {}
        if event.get("body"):
            body = json.loads(event["body"])

        action = body.get("action", "")

        if action == "cases.list":
            with conn.cursor() as cur:
                cur.execute(
                    f"""SELECT c.id, c.case_number, c.court, c.judge, c.plaintiff, c.defendant, c.status, c.created_at,
                        (SELECT COUNT(*) FROM {SCHEMA}.organizer_hearings WHERE case_id=c.id) AS hearings_count,
                        (SELECT COUNT(*) FROM {SCHEMA}.organizer_tasks WHERE case_id=c.id AND is_completed=FALSE) AS pending_tasks,
                        (SELECT COUNT(*) FROM {SCHEMA}.organizer_documents WHERE case_id=c.id) AS docs_total,
                        (SELECT COUNT(*) FROM {SCHEMA}.organizer_documents WHERE case_id=c.id AND is_prepared=TRUE) AS docs_ready,
                        (SELECT MIN(hear_date) FROM {SCHEMA}.organizer_hearings WHERE case_id=c.id AND hear_date >= CURRENT_DATE) AS next_hearing
                    FROM {SCHEMA}.organizer_cases c
                    WHERE c.user_id = %s AND c.status != 'deleted'
                    ORDER BY c.created_at DESC""",
                    (user_id,)
                )
                cols = [d[0] for d in cur.description]
                cases = [dict(zip(cols, row)) for row in cur.fetchall()]
            return resp(200, {"cases": cases})

        if action == "cases.get":
            case_id = body.get("case_id")
            with conn.cursor() as cur:
                cur.execute(f"SELECT id,case_number,court,judge,plaintiff,defendant,status,created_at FROM {SCHEMA}.organizer_cases WHERE id=%s AND user_id=%s AND status!='deleted'", (case_id, user_id))
                row = cur.fetchone()
                if not row:
                    return resp(404, {"error": "Дело не найдено"})
                c = dict(zip([d[0] for d in cur.description], row))
                cur.execute(f"SELECT id,hear_date,hear_time,room,result,notes FROM {SCHEMA}.organizer_hearings WHERE case_id=%s AND (result IS NULL OR result!='deleted') ORDER BY hear_date", (case_id,))
                c["hearings"] = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]
                cur.execute(f"SELECT id,title,due_date,is_completed,reminder FROM {SCHEMA}.organizer_tasks WHERE case_id=%s AND is_completed=FALSE ORDER BY due_date NULLS LAST", (case_id,))
                c["tasks"] = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]
                cur.execute(f"SELECT id,name,doc_type,is_prepared,deadline,notes FROM {SCHEMA}.organizer_documents WHERE case_id=%s ORDER BY created_at", (case_id,))
                c["documents"] = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]
            return resp(200, c)

        if action == "cases.create":
            case_number = (body.get("case_number") or "").strip()
            court = (body.get("court") or "").strip()
            if not case_number or not court:
                return resp(400, {"error": "case_number и court обязательны"})
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.organizer_cases (user_id, case_number, court, judge, plaintiff, defendant, status) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                    (user_id, case_number, court, body.get("judge"), body.get("plaintiff"), body.get("defendant"), body.get("status", "active"))
                )
                new_id = cur.fetchone()[0]
            conn.commit()
            return resp(201, {"id": new_id})

        if action == "cases.update":
            case_id = body.get("case_id")
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.organizer_cases SET case_number=%s, court=%s, judge=%s, plaintiff=%s, defendant=%s, status=%s, updated_at=NOW() WHERE id=%s AND user_id=%s",
                    (body.get("case_number"), body.get("court"), body.get("judge"), body.get("plaintiff"), body.get("defendant"), body.get("status", "active"), case_id, user_id)
                )
            conn.commit()
            return resp(200, {"ok": True})

        if action == "cases.delete":
            case_id = body.get("case_id")
            with conn.cursor() as cur:
                cur.execute(f"UPDATE {SCHEMA}.organizer_cases SET status='deleted' WHERE id=%s AND user_id=%s", (case_id, user_id))
            conn.commit()
            return resp(200, {"ok": True})

        if action == "hearings.create":
            case_id = body.get("case_id")
            hear_date = body.get("hear_date")
            if not hear_date:
                return resp(400, {"error": "hear_date обязателен"})
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.organizer_hearings (case_id,user_id,hear_date,hear_time,room,notes) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
                    (case_id, user_id, hear_date, body.get("hear_time"), body.get("room"), body.get("notes"))
                )
                new_id = cur.fetchone()[0]
            conn.commit()
            return resp(201, {"id": new_id})

        if action == "hearings.update":
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.organizer_hearings SET hear_date=%s,hear_time=%s,room=%s,notes=%s,result=%s WHERE id=%s AND user_id=%s",
                    (body.get("hear_date"), body.get("hear_time"), body.get("room"), body.get("notes"), body.get("result"), body.get("hearing_id"), user_id)
                )
            conn.commit()
            return resp(200, {"ok": True})

        if action == "hearings.delete":
            with conn.cursor() as cur:
                cur.execute(f"UPDATE {SCHEMA}.organizer_hearings SET result='deleted' WHERE id=%s AND user_id=%s", (body.get("hearing_id"), user_id))
            conn.commit()
            return resp(200, {"ok": True})

        if action == "tasks.create":
            title = (body.get("title") or "").strip()
            if not title:
                return resp(400, {"error": "title обязателен"})
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.organizer_tasks (case_id,user_id,title,due_date,reminder) VALUES (%s,%s,%s,%s,%s) RETURNING id",
                    (body.get("case_id"), user_id, title, body.get("due_date") or None, body.get("reminder", True))
                )
                new_id = cur.fetchone()[0]
            conn.commit()
            return resp(201, {"id": new_id})

        if action == "tasks.update":
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.organizer_tasks SET title=%s,due_date=%s,is_completed=%s,reminder=%s WHERE id=%s AND user_id=%s",
                    (body.get("title"), body.get("due_date") or None, body.get("is_completed", False), body.get("reminder", True), body.get("task_id"), user_id)
                )
            conn.commit()
            return resp(200, {"ok": True})

        if action == "tasks.delete":
            with conn.cursor() as cur:
                cur.execute(f"UPDATE {SCHEMA}.organizer_tasks SET is_completed=TRUE WHERE id=%s AND user_id=%s", (body.get("task_id"), user_id))
            conn.commit()
            return resp(200, {"ok": True})

        if action == "documents.create":
            name = (body.get("name") or "").strip()
            if not name:
                return resp(400, {"error": "name обязателен"})
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.organizer_documents (case_id,user_id,name,doc_type,deadline,notes) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
                    (body.get("case_id"), user_id, name, body.get("doc_type", "Другое"), body.get("deadline") or None, body.get("notes"))
                )
                new_id = cur.fetchone()[0]
            conn.commit()
            return resp(201, {"id": new_id})

        if action == "documents.update":
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.organizer_documents SET name=%s,doc_type=%s,is_prepared=%s,deadline=%s,notes=%s WHERE id=%s AND user_id=%s",
                    (body.get("name"), body.get("doc_type", "Другое"), body.get("is_prepared", False), body.get("deadline") or None, body.get("notes"), body.get("doc_id"), user_id)
                )
            conn.commit()
            return resp(200, {"ok": True})

        if action == "documents.delete":
            with conn.cursor() as cur:
                cur.execute(f"UPDATE {SCHEMA}.organizer_documents SET is_prepared=TRUE WHERE id=%s AND user_id=%s", (body.get("doc_id"), user_id))
            conn.commit()
            return resp(200, {"ok": True})

        return resp(400, {"error": f"Неизвестное действие: {action}"})
    finally:
        conn.close()