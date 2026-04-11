"""Авторизация: регистрация с паролем, вход по email+пароль, сессии."""
import os
import secrets
import hashlib
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")

ADMIN_EMAIL = "ilya.povarchuk@mail.ru"

_SELECT_COLS = "id, email, name, phone, free_questions_used, paid_questions, paid_docs, paid_expert, paid_business, is_admin"


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hash_password(password: str) -> str:
    salt = "yurist_ai_salt_2026"
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def generate_token() -> str:
    return secrets.token_hex(48)


def get_user_by_token(token: str) -> dict | None:
    if not token:
        return None
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT {_SELECT_COLS} FROM {SCHEMA}.users
                WHERE id = (
                    SELECT user_id FROM {SCHEMA}.sessions
                    WHERE token = %s AND expires_at > NOW()
                )""",
            (token,)
        )
        row = cur.fetchone()
        return _format_user(row) if row else None
    finally:
        cur.close()
        conn.close()


def handle_register(body: dict) -> dict:
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    phone = (body.get("phone") or "").strip()
    password = body.get("password") or ""
    agreed = body.get("agreed_to_terms", False)

    if not name:
        return _err(400, "Введите имя")
    if not email or "@" not in email:
        return _err(400, "Некорректный email")
    if not phone or len(phone) < 7:
        return _err(400, "Введите корректный телефон")
    if len(password) < 6:
        return _err(400, "Пароль должен быть не менее 6 символов")
    if not agreed:
        return _err(400, "Необходимо согласие на обработку персональных данных")

    pw_hash = hash_password(password)
    # Если регистрируется admin-email — сразу ставим is_admin=true
    is_admin = email == ADMIN_EMAIL

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email = %s", (email,))
        if cur.fetchone():
            return _err(409, "Пользователь с таким email уже зарегистрирован")

        cur.execute(
            f"""INSERT INTO {SCHEMA}.users (email, name, phone, password_hash, agreed_to_terms, is_admin)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (email, name, phone, pw_hash, agreed, is_admin)
        )
        user_id = cur.fetchone()[0]

        token = generate_token()
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
            (user_id, token)
        )
        conn.commit()

        cur.execute(
            f"SELECT {_SELECT_COLS} FROM {SCHEMA}.users WHERE id = %s",
            (user_id,)
        )
        u = cur.fetchone()
        return _ok({"token": token, "user": _format_user(u)})
    except Exception as e:
        conn.rollback()
        return _err(500, str(e))
    finally:
        cur.close()
        conn.close()


def handle_login(body: dict) -> dict:
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return _err(400, "Введите email и пароль")

    pw_hash = hash_password(password)
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT id FROM {SCHEMA}.users WHERE email = %s AND password_hash = %s",
            (email, pw_hash)
        )
        row = cur.fetchone()
        if not row:
            return _err(401, "Неверный email или пароль")

        user_id = row[0]
        token = generate_token()
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
            (user_id, token)
        )
        conn.commit()

        cur.execute(
            f"SELECT {_SELECT_COLS} FROM {SCHEMA}.users WHERE id = %s",
            (user_id,)
        )
        u = cur.fetchone()
        return _ok({"token": token, "user": _format_user(u)})
    except Exception as e:
        conn.rollback()
        return _err(500, str(e))
    finally:
        cur.close()
        conn.close()


def handle_me(token: str) -> dict:
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")
    return _ok({"user": user})


def handle_logout(token: str) -> dict:
    if token:
        conn = get_conn()
        cur = conn.cursor()
        try:
            cur.execute(
                f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE token = %s",
                (token,)
            )
            conn.commit()
        finally:
            cur.close()
            conn.close()
    return _ok({"message": "Выход выполнен"})


def handle_update_profile(token: str, body: dict) -> dict:
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")
    new_name = (body.get("name") or "").strip()
    new_phone = (body.get("phone") or "").strip()
    if new_name or new_phone:
        conn = get_conn()
        cur = conn.cursor()
        try:
            if new_name and new_phone:
                cur.execute(f"UPDATE {SCHEMA}.users SET name = %s, phone = %s WHERE id = %s", (new_name, new_phone, user["id"]))
            elif new_name:
                cur.execute(f"UPDATE {SCHEMA}.users SET name = %s WHERE id = %s", (new_name, user["id"]))
            elif new_phone:
                cur.execute(f"UPDATE {SCHEMA}.users SET phone = %s WHERE id = %s", (new_phone, user["id"]))
            conn.commit()
            cur.execute(f"SELECT {_SELECT_COLS} FROM {SCHEMA}.users WHERE id = %s", (user["id"],))
            u = cur.fetchone()
            return _ok({"user": _format_user(u)})
        finally:
            cur.close()
            conn.close()
    return _ok({"user": user})


def handle_consume_question(token: str) -> dict:
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")
    # Админ не тратит вопросы
    if user.get("isAdmin"):
        return _ok({"ok": True})
    conn = get_conn()
    cur = conn.cursor()
    try:
        if user["paidQuestions"] > 0:
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions - 1 WHERE id = %s", (user["id"],))
            conn.commit()
            return _ok({"ok": True})
        else:
            return _err(403, "Нет доступных вопросов")
    finally:
        cur.close()
        conn.close()


def handle_consume_doc(token: str) -> dict:
    """Списывает 1 документ. Для админа — бесплатно."""
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")
    if user.get("isAdmin"):
        return _ok({"ok": True})
    if user.get("paidDocs", 0) <= 0:
        return _err(403, "Нет доступных документов")
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(f"UPDATE {SCHEMA}.users SET paid_docs = paid_docs - 1 WHERE id = %s", (user["id"],))
        conn.commit()
        return _ok({"ok": True})
    finally:
        cur.close()
        conn.close()


def handle_add_paid_service(token: str, body: dict) -> dict:
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")
    service_type = body.get("service_type", "")
    conn = get_conn()
    cur = conn.cursor()
    try:
        if service_type == "consultation":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + 3 WHERE id = %s", (user["id"],))
        elif service_type == "document":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_docs = paid_docs + 1 WHERE id = %s", (user["id"],))
        elif service_type == "expert":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_expert = TRUE WHERE id = %s", (user["id"],))
        elif service_type == "business":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_business = paid_business + 1 WHERE id = %s", (user["id"],))
        conn.commit()
        return _ok({"ok": True})
    finally:
        cur.close()
        conn.close()


def _format_user(row) -> dict:
    return {
        "id": row[0],
        "email": row[1],
        "name": row[2],
        "phone": row[3],
        "freeQuestionsUsed": row[4],
        "paidQuestions": row[5],
        "paidDocs": row[6],
        "paidExpert": row[7],
        "paidBusiness": row[8],
        "isAdmin": bool(row[9]),
    }


def _ok(data: dict) -> dict:
    return {"status": 200, "data": data}


def _err(code: int, msg: str) -> dict:
    return {"status": code, "error": msg}