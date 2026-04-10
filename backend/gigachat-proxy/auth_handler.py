"""Авторизация через OTP на email."""
import os
import random
import secrets
import smtplib
import psycopg2
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def generate_token() -> str:
    return secrets.token_hex(48)


def send_otp_email(to_email: str, code: str):
    smtp_host = os.environ.get("SMTP_HOST", "smtp.yandex.ru")
    smtp_port = int(os.environ.get("SMTP_PORT", "465"))
    smtp_user = os.environ["SMTP_FROM_EMAIL"]
    smtp_pass = os.environ["SMTP_PASSWORD"]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Код входа в Юрист AI: {code}"
    msg["From"] = f"Юрист AI <{smtp_user}>"
    msg["To"] = to_email

    html = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #1e3a5f; margin-bottom: 8px;">Юрист AI</h2>
      <p style="color: #555; margin-bottom: 24px;">Код для входа в личный кабинет:</p>
      <div style="background: #f4f7fb; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 40px; font-weight: bold; letter-spacing: 8px; color: #1e3a5f;">{code}</span>
      </div>
      <p style="color: #888; font-size: 13px;">Код действует 10 минут. Не передавайте его никому.</p>
      <p style="color: #888; font-size: 13px;">Если вы не запрашивали код — просто проигнорируйте это письмо.</p>
    </div>
    """
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, to_email, msg.as_string())


def get_user_by_token(token: str) -> dict | None:
    if not token:
        return None
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT u.id, u.email, u.name, u.free_questions_used, u.paid_questions,
                       u.paid_docs, u.paid_expert, u.paid_business
                FROM {SCHEMA}.sessions s
                JOIN {SCHEMA}.users u ON u.id = s.user_id
                WHERE s.token = %s AND s.expires_at > NOW()""",
            (token,)
        )
        row = cur.fetchone()
        return _format_user(row) if row else None
    finally:
        cur.close()
        conn.close()


def handle_send_otp(body: dict) -> dict:
    email = (body.get("email") or "").strip().lower()
    if not email or "@" not in email:
        return _err(400, "Некорректный email")

    code = str(random.randint(100000, 999999))
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"INSERT INTO {SCHEMA}.otp_codes (email, code) VALUES (%s, %s)",
            (email, code)
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()

    try:
        send_otp_email(email, code)
    except Exception as e:
        return _err(500, f"Ошибка отправки email: {str(e)}")

    return _ok({"message": "Код отправлен на email"})


def handle_verify_otp(body: dict) -> dict:
    email = (body.get("email") or "").strip().lower()
    code = (body.get("code") or "").strip()
    name = (body.get("name") or "").strip()

    if not email or not code:
        return _err(400, "Email и код обязательны")

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT id FROM {SCHEMA}.otp_codes
                WHERE email = %s AND code = %s AND used = FALSE AND expires_at > NOW()
                ORDER BY id DESC LIMIT 1""",
            (email, code)
        )
        row = cur.fetchone()
        if not row:
            return _err(401, "Неверный или истёкший код")

        otp_id = row[0]
        cur.execute(f"UPDATE {SCHEMA}.otp_codes SET used = TRUE WHERE id = %s", (otp_id,))

        cur.execute(
            f"SELECT id FROM {SCHEMA}.users WHERE email = %s",
            (email,)
        )
        user_row = cur.fetchone()

        if user_row:
            user_id = user_row[0]
        else:
            display_name = name or email.split("@")[0]
            cur.execute(
                f"INSERT INTO {SCHEMA}.users (email, name) VALUES (%s, %s) RETURNING id",
                (email, display_name)
            )
            user_id = cur.fetchone()[0]

        session_token = generate_token()
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
            (user_id, session_token)
        )
        conn.commit()

        cur.execute(
            f"SELECT id, email, name, free_questions_used, paid_questions, paid_docs, paid_expert, paid_business FROM {SCHEMA}.users WHERE id = %s",
            (user_id,)
        )
        u = cur.fetchone()
        return _ok({"token": session_token, "user": _format_user(u)})
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
    if new_name:
        conn = get_conn()
        cur = conn.cursor()
        try:
            cur.execute(
                f"UPDATE {SCHEMA}.users SET name = %s WHERE id = %s",
                (new_name, user["id"])
            )
            conn.commit()
            cur.execute(
                f"SELECT id, email, name, free_questions_used, paid_questions, paid_docs, paid_expert, paid_business FROM {SCHEMA}.users WHERE id = %s",
                (user["id"],)
            )
            u = cur.fetchone()
            return _ok({"user": _format_user(u)})
        finally:
            cur.close()
            conn.close()
    return _ok({"user": user})


def handle_consume_question(token: str) -> dict:
    """Списать вопрос у пользователя."""
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")

    conn = get_conn()
    cur = conn.cursor()
    try:
        if user["freeQuestionsUsed"] < 30:
            cur.execute(
                f"UPDATE {SCHEMA}.users SET free_questions_used = free_questions_used + 1 WHERE id = %s",
                (user["id"],)
            )
            conn.commit()
            return _ok({"ok": True})
        elif user["paidQuestions"] > 0:
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions - 1 WHERE id = %s",
                (user["id"],)
            )
            conn.commit()
            return _ok({"ok": True})
        else:
            return _err(403, "Нет доступных вопросов")
    finally:
        cur.close()
        conn.close()


def handle_add_paid_service(token: str, body: dict) -> dict:
    """Начислить оплаченную услугу пользователю."""
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
        "freeQuestionsUsed": row[3],
        "paidQuestions": row[4],
        "paidDocs": row[5],
        "paidExpert": row[6],
        "paidBusiness": row[7],
    }


def _ok(data: dict) -> dict:
    return {"status": 200, "data": data}


def _err(code: int, message: str) -> dict:
    return {"status": code, "error": message}
