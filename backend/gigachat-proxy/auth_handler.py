"""Авторизация: регистрация, вход, сессии, подписки, rate-limiting, отчёты об ошибках."""
import os
import re
import secrets
import hashlib
import smtplib
import psycopg2
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.header import Header

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")
ADMIN_EMAIL = "ilya.povarchuk@mail.ru"
REPORT_EMAIL = "povpartner@mail.ru"

_SELECT_COLS = (
    "id, email, name, phone, free_questions_used, paid_questions, "
    "paid_docs, paid_expert, paid_business, is_admin, "
    "subscription_consult_until, subscription_docs_until"
)

MAX_LOGIN_ATTEMPTS = 10
LOGIN_WINDOW_MINUTES = 15

# История хранится 3 месяца, профиль удаляется после 1 года неактивности
HISTORY_TTL_DAYS = 92
INACTIVE_PROFILE_DAYS = 365


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hash_password(password: str) -> str:
    salt = "yurist_ai_salt_2026"
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def generate_token() -> str:
    return secrets.token_hex(48)


def sanitize_str(s: str, max_len: int = 255) -> str:
    if not s:
        return ""
    cleaned = re.sub(r'[\x00-\x1f\x7f]', '', str(s))
    return cleaned[:max_len].strip()


def run_cleanup(conn):
    """Очищает старые сессии, устаревшие профили и пр. Запускается при каждом auth-запросе."""
    cur = conn.cursor()
    try:
        # Удаляем истёкшие сессии старше 7 дней
        cur.execute(
            f"DELETE FROM {SCHEMA}.sessions WHERE expires_at < NOW() - INTERVAL '7 days'"
        )
        # Удаляем пользователей, которые не заходили более года (и не являются админами)
        inactive_threshold = datetime.utcnow() - timedelta(days=INACTIVE_PROFILE_DAYS)
        cur.execute(
            f"""DELETE FROM {SCHEMA}.users
                WHERE last_login_at < %s AND is_admin = FALSE""",
            (inactive_threshold,)
        )
        conn.commit()
    except Exception:
        conn.rollback()
    finally:
        cur.close()


def get_user_by_token(token: str) -> dict | None:
    if not token or len(token) > 200:
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
    name = sanitize_str(body.get("name") or "")
    email = sanitize_str(body.get("email") or "").lower()
    phone = sanitize_str(body.get("phone") or "")
    password = body.get("password") or ""
    agreed = body.get("agreed_to_terms", False)

    if not name:
        return _err(400, "Введите имя")
    if not email or "@" not in email or len(email) > 254:
        return _err(400, "Некорректный email")
    if not phone or len(phone) < 7:
        return _err(400, "Введите корректный телефон")
    if len(password) < 6:
        return _err(400, "Пароль должен быть не менее 6 символов")
    if len(password) > 128:
        return _err(400, "Пароль слишком длинный")
    if not agreed:
        return _err(400, "Необходимо согласие на обработку персональных данных")

    pw_hash = hash_password(password)
    is_admin = email == ADMIN_EMAIL

    conn = get_conn()
    cur = conn.cursor()
    try:
        run_cleanup(conn)
        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email = %s", (email,))
        if cur.fetchone():
            return _err(409, "Пользователь с таким email уже зарегистрирован")

        cur.execute(
            f"""INSERT INTO {SCHEMA}.users (email, name, phone, password_hash, agreed_to_terms, is_admin, last_login_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW()) RETURNING id""",
            (email, name, phone, pw_hash, agreed, is_admin)
        )
        user_id = cur.fetchone()[0]

        token = generate_token()
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
            (user_id, token)
        )
        conn.commit()

        cur.execute(f"SELECT {_SELECT_COLS} FROM {SCHEMA}.users WHERE id = %s", (user_id,))
        u = cur.fetchone()
        return _ok({"token": token, "user": _format_user(u)})
    except Exception as e:
        conn.rollback()
        return _err(500, str(e))
    finally:
        cur.close()
        conn.close()


def handle_login(body: dict, ip: str = "") -> dict:
    email = sanitize_str(body.get("email") or "").lower()
    password = body.get("password") or ""

    if not email or not password:
        return _err(400, "Введите email и пароль")
    if len(password) > 128:
        return _err(400, "Некорректный пароль")

    pw_hash = hash_password(password)
    conn = get_conn()
    cur = conn.cursor()
    try:
        run_cleanup(conn)
        cur.execute(
            f"SELECT id FROM {SCHEMA}.users WHERE email = %s AND password_hash = %s",
            (email, pw_hash)
        )
        row = cur.fetchone()
        if not row:
            return _err(401, "Неверный email или пароль")

        user_id = row[0]
        # Обновляем дату последнего входа
        cur.execute(
            f"UPDATE {SCHEMA}.users SET last_login_at = NOW() WHERE id = %s",
            (user_id,)
        )
        token = generate_token()
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
            (user_id, token)
        )
        conn.commit()

        cur.execute(f"SELECT {_SELECT_COLS} FROM {SCHEMA}.users WHERE id = %s", (user_id,))
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
    if token and len(token) <= 200:
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
    new_name = sanitize_str(body.get("name") or "")
    new_phone = sanitize_str(body.get("phone") or "")
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
    if user.get("isAdmin", False) or _has_active_subscription(user, "consult"):
        return _ok({"ok": True})
    conn = get_conn()
    cur = conn.cursor()
    try:
        if user.get("paidQuestions", 0) > 0:
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions - 1 WHERE id = %s", (user["id"],))
            conn.commit()
            return _ok({"ok": True})
        else:
            return _err(403, "Нет доступных вопросов")
    finally:
        cur.close()
        conn.close()


def handle_consume_doc(token: str) -> dict:
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")
    if user.get("isAdmin", False) or _has_active_subscription(user, "docs"):
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
    service_type = sanitize_str(body.get("service_type") or "")
    conn = get_conn()
    cur = conn.cursor()
    try:
        if service_type == "consultation":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + 3 WHERE id = %s", (user["id"],))
        elif service_type == "trial":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + 1 WHERE id = %s", (user["id"],))
        elif service_type == "document":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_docs = paid_docs + 1 WHERE id = %s", (user["id"],))
        elif service_type == "expert":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_expert = TRUE WHERE id = %s", (user["id"],))
        elif service_type == "business":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_business = paid_business + 1 WHERE id = %s", (user["id"],))
        elif service_type == "subscription_consult":
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET subscription_consult_until = GREATEST(NOW(), COALESCE(subscription_consult_until, NOW())) + INTERVAL '31 days'
                    WHERE id = %s""",
                (user["id"],)
            )
        elif service_type == "subscription_docs":
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET subscription_docs_until = GREATEST(NOW(), COALESCE(subscription_docs_until, NOW())) + INTERVAL '31 days'
                    WHERE id = %s""",
                (user["id"],)
            )
        conn.commit()
        return _ok({"ok": True})
    finally:
        cur.close()
        conn.close()


def _send_email(to_email: str, subject: str, body_text: str) -> None:
    """Отправляет письмо через Яндекс SMTP."""
    smtp_from = os.environ.get("SMTP_FROM_EMAIL", "").strip()
    smtp_pass = os.environ.get("SMTP_PASSWORD", "").strip()
    if not smtp_from or not smtp_pass:
        raise RuntimeError("SMTP не настроен")

    msg = MIMEText(body_text, "plain", "utf-8")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = smtp_from
    msg["To"] = to_email

    last_err = None
    # Попытка 1: SSL 465
    try:
        with smtplib.SMTP_SSL("smtp.yandex.ru", 465, timeout=15) as server:
            server.login(smtp_from, smtp_pass)
            server.sendmail(smtp_from, [to_email], msg.as_string())
        return  # успех
    except Exception as e:
        last_err = f"SSL-465: {e}"

    # Попытка 2: STARTTLS 587
    try:
        with smtplib.SMTP("smtp.yandex.ru", 587, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_from, smtp_pass)
            server.sendmail(smtp_from, [to_email], msg.as_string())
        return  # успех
    except Exception as e:
        last_err = f"{last_err} | STARTTLS-587: {e}"

    raise RuntimeError(f"Не удалось отправить письмо: {last_err}")


def handle_send_otp(body: dict) -> dict:
    """Генерирует 6-значный OTP и отправляет на email."""
    email = sanitize_str(body.get("email") or "").lower()
    if not email or "@" not in email:
        return _err(400, "Некорректный email")

    code = str(secrets.randbelow(900000) + 100000)  # 100000–999999
    conn = get_conn()
    cur = conn.cursor()
    try:
        # Инвалидируем старые коды
        cur.execute(
            f"UPDATE {SCHEMA}.otp_codes SET used = TRUE WHERE email = %s AND used = FALSE",
            (email,)
        )
        cur.execute(
            f"INSERT INTO {SCHEMA}.otp_codes (email, code) VALUES (%s, %s)",
            (email, code)
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()

    try:
        _send_email(
            to_email=email,
            subject="Юрист AI — код подтверждения",
            body_text=(
                f"Ваш код подтверждения для регистрации на сайте Юрист AI:\n\n"
                f"  {code}\n\n"
                f"Код действителен 10 минут. Никому не сообщайте его.\n\n"
                f"Если вы не запрашивали регистрацию — проигнорируйте это письмо."
            )
        )
    except Exception as e:
        return _err(500, f"Ошибка отправки письма: {str(e)}")

    return _ok({"ok": True, "hint": "Код отправлен на почту"})


def handle_verify_otp(body: dict) -> dict:
    """Проверяет OTP-код без регистрации (для шага верификации email)."""
    email = sanitize_str(body.get("email") or "").lower()
    code = sanitize_str(body.get("code") or "")
    if not email or not code:
        return _err(400, "Укажите email и код")

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT id FROM {SCHEMA}.otp_codes
                WHERE email = %s AND code = %s AND used = FALSE AND expires_at > NOW()
                ORDER BY created_at DESC LIMIT 1""",
            (email, code)
        )
        row = cur.fetchone()
        if not row:
            return _err(400, "Неверный или истёкший код")
        # Не помечаем как использованный — пометим при финальной регистрации
        return _ok({"ok": True})
    finally:
        cur.close()
        conn.close()


def handle_register(body: dict) -> dict:
    name = sanitize_str(body.get("name") or "")
    email = sanitize_str(body.get("email") or "").lower()
    phone = sanitize_str(body.get("phone") or "")
    password = body.get("password") or ""
    agreed = body.get("agreed_to_terms", False)
    otp_code = sanitize_str(body.get("otp_code") or "")

    if not name:
        return _err(400, "Введите имя")
    if not email or "@" not in email or len(email) > 254:
        return _err(400, "Некорректный email")
    if not phone or len(phone) < 7:
        return _err(400, "Введите корректный телефон")
    if len(password) < 6:
        return _err(400, "Пароль должен быть не менее 6 символов")
    if len(password) > 128:
        return _err(400, "Пароль слишком длинный")
    if not agreed:
        return _err(400, "Необходимо согласие на обработку персональных данных")
    if not otp_code:
        return _err(400, "Введите код подтверждения из письма")

    # Проверяем OTP
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT id FROM {SCHEMA}.otp_codes
                WHERE email = %s AND code = %s AND used = FALSE AND expires_at > NOW()
                ORDER BY created_at DESC LIMIT 1""",
            (email, otp_code)
        )
        otp_row = cur.fetchone()
        if not otp_row:
            return _err(400, "Неверный или истёкший код подтверждения. Запросите новый.")
        otp_id = otp_row[0]

        run_cleanup(conn)
        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email = %s", (email,))
        if cur.fetchone():
            return _err(409, "Пользователь с таким email уже зарегистрирован")

        pw_hash = hash_password(password)
        is_admin = email == ADMIN_EMAIL

        cur.execute(
            f"""INSERT INTO {SCHEMA}.users (email, name, phone, password_hash, agreed_to_terms, is_admin, last_login_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW()) RETURNING id""",
            (email, name, phone, pw_hash, agreed, is_admin)
        )
        user_id = cur.fetchone()[0]

        # Помечаем OTP как использованный
        cur.execute(f"UPDATE {SCHEMA}.otp_codes SET used = TRUE WHERE id = %s", (otp_id,))

        token = generate_token()
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
            (user_id, token)
        )
        conn.commit()

        cur.execute(f"SELECT {_SELECT_COLS} FROM {SCHEMA}.users WHERE id = %s", (user_id,))
        u = cur.fetchone()
        return _ok({"token": token, "user": _format_user(u)})
    except Exception as e:
        conn.rollback()
        return _err(500, str(e))
    finally:
        cur.close()
        conn.close()


# Старый handle_register сохраняется с другим именем — не нужен, убираем дублирование


def handle_report(token: str, body: dict) -> dict:
    """Отправляет сообщение об ошибке на email поддержки."""
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")

    message = sanitize_str(body.get("message") or "", max_len=2000)
    if not message:
        return _err(400, "Сообщение не может быть пустым")

    smtp_from = os.environ.get("SMTP_FROM_EMAIL", "").strip()
    smtp_pass = os.environ.get("SMTP_PASSWORD", "").strip()
    if not smtp_from or not smtp_pass:
        return _err(500, "SMTP не настроен")

    subject = f"[Юрист AI] Проблема от {user['name']} ({user['email']})"
    body_text = (
        f"Пользователь: {user['name']}\n"
        f"Email: {user['email']}\n"
        f"Дата: {datetime.utcnow().strftime('%d.%m.%Y %H:%M UTC')}\n\n"
        f"Сообщение:\n{message}"
    )

    try:
        msg = MIMEText(body_text, "plain", "utf-8")
        msg["Subject"] = Header(subject, "utf-8")
        msg["From"] = smtp_from
        msg["To"] = REPORT_EMAIL
        msg["Reply-To"] = user["email"]

        # Пробуем SMTP_SSL (465), при ошибке — STARTTLS (587)
        try:
            with smtplib.SMTP_SSL("smtp.yandex.ru", 465, timeout=15) as server:
                server.login(smtp_from, smtp_pass)
                server.sendmail(smtp_from, [REPORT_EMAIL], msg.as_string())
        except Exception:
            with smtplib.SMTP("smtp.yandex.ru", 587, timeout=15) as server:
                server.starttls()
                server.login(smtp_from, smtp_pass)
                server.sendmail(smtp_from, [REPORT_EMAIL], msg.as_string())

        return _ok({"ok": True})
    except Exception as e:
        return _err(500, f"Ошибка отправки: {str(e)}")


def _has_active_subscription(user: dict, kind: str) -> bool:
    if kind == "consult":
        until = user.get("subscriptionConsultUntil")
    else:
        until = user.get("subscriptionDocsUntil")
    if not until:
        return False
    if isinstance(until, str):
        try:
            until_dt = datetime.fromisoformat(until.replace("Z", "+00:00").replace("+00:00", ""))
        except Exception:
            return False
    else:
        until_dt = until
    return until_dt > datetime.utcnow()


def _format_user(row) -> dict:
    def _fmt_dt(v):
        if v is None:
            return None
        if isinstance(v, datetime):
            return v.isoformat()
        return str(v)

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
        "subscriptionConsultUntil": _fmt_dt(row[10]),
        "subscriptionDocsUntil": _fmt_dt(row[11]),
    }


def _ok(data: dict) -> dict:
    return {"status": 200, "data": data}


def _err(code: int, msg: str) -> dict:
    return {"status": code, "error": msg}