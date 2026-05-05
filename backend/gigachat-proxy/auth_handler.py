"""Авторизация: регистрация, вход, сессии, подписки, rate-limiting, отчёты об ошибках. v4."""
import os
import re
import secrets
import hashlib
import random
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
    "subscription_consult_until, subscription_docs_until, "
    "business_subscription_until, business_actions_left, business_org_name, referral_code"
)

MAX_LOGIN_ATTEMPTS = 10
LOGIN_WINDOW_MINUTES = 15

# Для входа администратора — жёсткий лимит 3 попытки за 30 минут
ADMIN_MAX_LOGIN_ATTEMPTS = 3
ADMIN_LOGIN_WINDOW_MINUTES = 30

# История хранится 3 месяца, профиль удаляется после 1 года неактивности
HISTORY_TTL_DAYS = 92
INACTIVE_PROFILE_DAYS = 365


def get_conn():
    return psycopg2.connect(
        os.environ["DATABASE_URL"],
        connect_timeout=8,
        options="-c statement_timeout=15000",
    )


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
    """Очищает старые сессии, устаревшие профили и закрытые жалобы. Запускается вероятностно (1 из 20 запросов)."""
    if random.randint(1, 20) != 1:
        return
    cur = conn.cursor()
    try:
        cur.execute(
            f"DELETE FROM {SCHEMA}.sessions WHERE expires_at < NOW() - INTERVAL '7 days'"
        )
        inactive_threshold = datetime.utcnow() - timedelta(days=INACTIVE_PROFILE_DAYS)
        cur.execute(
            f"""DELETE FROM {SCHEMA}.users
                WHERE last_login_at < %s AND is_admin = FALSE""",
            (inactive_threshold,)
        )
        # Удаляем закрытые жалобы старше 24 часов
        cur.execute(
            f"""DELETE FROM {SCHEMA}.reports
                WHERE status = 'closed'
                  AND COALESCE(replied_at, created_at) < NOW() - INTERVAL '24 hours'"""
        )
        # Также удаляем устаревшие попытки входа (старше 7 дней — чтобы таблица не росла)
        cur.execute(
            f"DELETE FROM {SCHEMA}.login_attempts WHERE attempted_at < NOW() - INTERVAL '7 days'"
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


def _normalize_phone(phone: str) -> str:
    """Нормализует телефон: оставляет только цифры, приводит к формату 7XXXXXXXXXX."""
    digits = re.sub(r'\D', '', phone)
    if len(digits) == 11 and digits[0] in ('7', '8'):
        return '7' + digits[1:]
    if len(digits) == 10:
        return '7' + digits
    return digits


GRANT_SERVICE_MAP = {
    "consultation":          ("paid_expert", None, None),
    "document":              (None, "paid_docs", 1),
    "expert":                ("paid_expert", None, None),
    "plan_starter":          (None, None, None),
    "plan_starter_discount": (None, None, None),
    "plan_pro":              (None, None, None),
    "plan_max":              ("paid_expert", None, None),
    "plan_max_expert":       ("paid_expert", None, None),
}


def _credit_pending_orders(conn, user_id: int, email: str) -> int:
    """Зачисляет незакрытые оплаченные ордера по email. Возвращает кол-во зачисленных.
    Атомарное обновление через RETURNING защищает от двойного зачисления при параллельных запросах."""
    credited = 0
    cur = conn.cursor()
    try:
        # Атомарно помечаем ордера как зачисленные — только те которые ещё не зачислены
        cur.execute(
            f"""UPDATE {SCHEMA}.orders
                SET service_credited = TRUE, user_id = %s
                WHERE LOWER(user_email) = %s AND status = 'paid' AND service_credited = FALSE
                RETURNING id, service_type, amount""",
            (user_id, email.lower())
        )
        rows = cur.fetchall()
        conn.commit()

        for order_id, service_type, amount in rows:
            try:
                _apply_service_grant(conn, user_id, service_type)
                cur2 = conn.cursor()
                cur2.execute(
                    f"""INSERT INTO {SCHEMA}.billing_log
                        (user_id, user_email, service_type, amount, description, source)
                        VALUES (%s, %s, %s, %s, %s, 'auto_credit_on_login')""",
                    (user_id, email, service_type, amount, f"Автозачисление при входе: {service_type}")
                )
                conn.commit()
                cur2.close()
                credited += 1
                print(f"[AUTH] Автозачислен ордер id={order_id} service={service_type} → user_id={user_id}")
            except Exception as e:
                conn.rollback()
                print(f"[AUTH] Ошибка зачисления ордера id={order_id}: {e}")
    finally:
        cur.close()
    return credited


def _apply_service_grant(conn, user_id: int, service_type: str):
    cur = conn.cursor()
    try:
        if service_type == "consultation":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_expert = TRUE WHERE id = %s", (user_id,))
        elif service_type == "document":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_docs = paid_docs + 1 WHERE id = %s", (user_id,))
        elif service_type == "expert":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_expert = TRUE WHERE id = %s", (user_id,))
        elif service_type in ("plan_starter", "plan_starter_discount"):
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + 30, paid_docs = paid_docs + 5 WHERE id = %s", (user_id,))
        elif service_type == "plan_pro":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + 100, paid_docs = paid_docs + 20 WHERE id = %s", (user_id,))
        elif service_type in ("plan_max", "plan_max_expert"):
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + 300, paid_docs = paid_docs + 50, paid_expert = TRUE WHERE id = %s", (user_id,))
        elif service_type == "subscription_consult":
            cur.execute(f"UPDATE {SCHEMA}.users SET subscription_consult_until = GREATEST(NOW(), COALESCE(subscription_consult_until, NOW())) + INTERVAL '31 days' WHERE id = %s", (user_id,))
        elif service_type == "subscription_docs":
            cur.execute(f"UPDATE {SCHEMA}.users SET subscription_docs_until = GREATEST(NOW(), COALESCE(subscription_docs_until, NOW())) + INTERVAL '31 days' WHERE id = %s", (user_id,))
        elif service_type == "business_subscription":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_subscription_until = GREATEST(NOW(), COALESCE(business_subscription_until, NOW())) + INTERVAL '31 days', business_actions_left = business_actions_left + 150 WHERE id = %s", (user_id,))
        elif service_type == "business_actions_10":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left + 10 WHERE id = %s", (user_id,))
        elif service_type == "business_actions_30":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left + 30 WHERE id = %s", (user_id,))
        elif service_type == "business_actions_50":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left + 50 WHERE id = %s", (user_id,))
        elif service_type == "business_actions_60":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left + 60 WHERE id = %s", (user_id,))
        elif service_type == "business_actions_150":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left + 150 WHERE id = %s", (user_id,))
        conn.commit()
    finally:
        cur.close()


def handle_register(body: dict) -> dict:
    name = sanitize_str(body.get("name") or "")
    email = sanitize_str(body.get("email") or "").lower()
    phone = sanitize_str(body.get("phone") or "")
    password = body.get("password") or ""
    agreed = body.get("agreed_to_terms", False)
    free_trial = bool(body.get("free_trial", False))

    if not name:
        return _err(400, "Введите имя")
    if not email or "@" not in email or len(email) > 254:
        return _err(400, "Некорректный email")
    if phone and len(phone) > 0 and len(phone) < 7:
        return _err(400, "Введите корректный номер телефона")
    if len(password) < 6:
        return _err(400, "Пароль должен быть не менее 6 символов")
    if len(password) > 128:
        return _err(400, "Пароль слишком длинный")
    if not agreed:
        return _err(400, "Необходимо согласие на обработку персональных данных")

    pw_hash = hash_password(password)
    is_admin = email == ADMIN_EMAIL
    phone_norm = _normalize_phone(phone)

    conn = get_conn()
    cur = conn.cursor()
    try:
        run_cleanup(conn)
        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email = %s", (email,))
        if cur.fetchone():
            return _err(409, "Пользователь с таким email уже зарегистрирован")

        # 1 бесплатный вопрос всем новым пользователям при регистрации
        trial_questions = 0 if is_admin else 1

        # Реферальный код — если указан, начислим бонус после создания
        ref_code = sanitize_str(body.get("ref_code") or "", max_len=32)

        cur.execute(
            f"""INSERT INTO {SCHEMA}.users (email, name, phone, phone_norm, password_hash, agreed_to_terms, is_admin, paid_questions, last_login_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW()) RETURNING id""",
            (email, name, phone, phone_norm, pw_hash, agreed, is_admin, trial_questions)
        )
        user_id = cur.fetchone()[0]

        token = generate_token()
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token, expires_at) VALUES (%s, %s, NOW() + INTERVAL '90 days')",
            (user_id, token)
        )
        conn.commit()

        # Обрабатываем реферальный код — начисляем 2 вопроса рефереру и новому юзеру
        ref_bonus_granted = False
        if ref_code and not is_admin:
            try:
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.users WHERE referral_code = %s AND id != %s",
                    (ref_code, user_id)
                )
                ref_row = cur.fetchone()
                if ref_row:
                    referrer_id = ref_row[0]
                    # +2 вопроса рефереру
                    cur.execute(
                        f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + 2 WHERE id = %s",
                        (referrer_id,)
                    )
                    # +2 вопроса новому пользователю (дополнительно к trial)
                    cur.execute(
                        f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + 2 WHERE id = %s",
                        (user_id,)
                    )
                    conn.commit()
                    ref_bonus_granted = True
            except Exception:
                pass

        # Страховка: зачисляем незакрытые оплаченные ордера по email (если платил до регистрации)
        try:
            _credit_pending_orders(conn, user_id, email)
        except Exception:
            pass

        cur.execute(f"SELECT {_SELECT_COLS} FROM {SCHEMA}.users WHERE id = %s", (user_id,))
        u = cur.fetchone()
        result = _ok({"token": token, "user": _format_user(u)})
        if free_trial:
            result["data"]["free_trial_granted"] = trial_questions > 0
        result["data"]["ref_bonus_granted"] = ref_bonus_granted
        return result
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

    is_admin_email = (email == ADMIN_EMAIL.lower())

    pw_hash = hash_password(password)
    conn = get_conn()
    cur = conn.cursor()
    try:
        run_cleanup(conn)

        # Для администратора — жёсткий rate-limit по IP и email
        if is_admin_email and ip:
            window = ADMIN_LOGIN_WINDOW_MINUTES
            max_att = ADMIN_MAX_LOGIN_ATTEMPTS
            cur.execute(
                f"""SELECT COUNT(*) FROM {SCHEMA}.login_attempts
                    WHERE (ip = %s OR email = %s)
                      AND success = FALSE
                      AND attempted_at > NOW() - INTERVAL '{window} minutes'""",
                (ip, email)
            )
            fail_count = cur.fetchone()[0]
            if fail_count >= max_att:
                return _err(429, f"Слишком много неудачных попыток входа для администратора. Подождите {window} минут.")

        cur.execute(
            f"SELECT id FROM {SCHEMA}.users WHERE email = %s AND password_hash = %s",
            (email, pw_hash)
        )
        row = cur.fetchone()
        if not row:
            # Логируем неудачную попытку
            try:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.login_attempts (ip, email, success) VALUES (%s, %s, FALSE)",
                    (ip or "unknown", email)
                )
                conn.commit()
            except Exception:
                conn.rollback()
            return _err(401, "Неверный email или пароль")

        user_id = row[0]
        # Обновляем дату последнего входа
        cur.execute(
            f"UPDATE {SCHEMA}.users SET last_login_at = NOW() WHERE id = %s",
            (user_id,)
        )
        # Множество сессий — каждое устройство имеет свой токен
        # Удаляем только совсем старые сессии (>30 дней) чтобы не копились
        cur.execute(
            f"DELETE FROM {SCHEMA}.sessions WHERE user_id = %s AND expires_at < NOW()",
            (user_id,)
        )
        token = generate_token()
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token, expires_at) VALUES (%s, %s, NOW() + INTERVAL '90 days')",
            (user_id, token)
        )
        conn.commit()

        # Логируем успешный вход
        try:
            cur.execute(
                f"INSERT INTO {SCHEMA}.login_attempts (ip, email, success) VALUES (%s, %s, TRUE)",
                (ip or "unknown", email)
            )
            conn.commit()
        except Exception:
            conn.rollback()

        # Страховка: зачисляем незакрытые оплаченные ордера по email (если платил до входа)
        try:
            _credit_pending_orders(conn, user_id, email)
        except Exception:
            pass

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
        return _ok({"ok": True, "is_last_question": False})
    conn = get_conn()
    cur = conn.cursor()
    try:
        q = user.get("paidQuestions", 0)
        if q > 0:
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions - 1 WHERE id = %s", (user["id"],))
            conn.commit()
            # is_last_question = True только когда у пользователя был ровно 1 вопрос (последний)
            return _ok({"ok": True, "is_last_question": q == 1})
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


def handle_refund_doc(token: str) -> dict:
    """Возврат 1 слота документа если генерация упала на стороне AI — best-effort."""
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")
    if user.get("isAdmin", False) or _has_active_subscription(user, "docs"):
        return _ok({"ok": True})
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(f"UPDATE {SCHEMA}.users SET paid_docs = paid_docs + 1 WHERE id = %s", (user["id"],))
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
    inv_id = body.get("inv_id")
    conn = get_conn()
    cur = conn.cursor()
    try:
        # Защита от двойного начисления: если inv_id передан — проверяем и помечаем атомарно
        if inv_id:
            cur.execute(
                f"UPDATE {SCHEMA}.orders SET service_credited = TRUE WHERE inv_id = %s AND service_credited = FALSE AND status = 'paid' RETURNING id",
                (inv_id,)
            )
            if not cur.fetchone():
                conn.rollback()
                return _ok({"ok": True, "skipped": True})

        if service_type == "consultation":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + 3 WHERE id = %s", (user["id"],))
        elif service_type == "trial":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + 2 WHERE id = %s", (user["id"],))
        elif service_type == "document":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_docs = paid_docs + 1 WHERE id = %s", (user["id"],))
        elif service_type == "expert":
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET paid_expert = TRUE,
                        paid_questions = CASE
                            WHEN paid_questions = 0 AND (subscription_consult_until IS NULL OR subscription_consult_until < NOW()) THEN 3
                            ELSE paid_questions
                        END
                    WHERE id = %s""",
                (user["id"],)
            )
        elif service_type == "business":
            cur.execute(f"UPDATE {SCHEMA}.users SET paid_business = paid_business + 1 WHERE id = %s", (user["id"],))
        # ── Новые пользовательские тарифы ──
        elif service_type in ("plan_starter", "plan_starter_discount"):
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET paid_questions = paid_questions + 30,
                        paid_docs = paid_docs + 5
                    WHERE id = %s""",
                (user["id"],)
            )
        elif service_type == "plan_pro":
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET paid_questions = paid_questions + 100,
                        paid_docs = paid_docs + 20
                    WHERE id = %s""",
                (user["id"],)
            )
        elif service_type in ("plan_max", "plan_max_expert"):
            # Тариф Максимум: 300 вопросов, 50 документов, доступ к юристу
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET paid_questions = paid_questions + 300,
                        paid_docs = paid_docs + 50,
                        paid_expert = TRUE
                    WHERE id = %s""",
                (user["id"],)
            )
        # ── Бизнес-тариф: 150 действий ──
        elif service_type == "business_subscription":
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET business_subscription_until = GREATEST(NOW(), COALESCE(business_subscription_until, NOW())) + INTERVAL '31 days',
                        business_actions_left = business_actions_left + 150
                    WHERE id = %s""",
                (user["id"],)
            )
        elif service_type == "business_actions_10":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left + 10 WHERE id = %s", (user["id"],))
        elif service_type == "business_actions_30":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left + 30 WHERE id = %s", (user["id"],))
        elif service_type == "business_actions_50":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left + 50 WHERE id = %s", (user["id"],))
        elif service_type == "business_actions_60":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left + 60 WHERE id = %s", (user["id"],))
        elif service_type == "business_actions_150":
            cur.execute(f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left + 150 WHERE id = %s", (user["id"],))
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


def handle_change_password(token: str, body: dict) -> dict:
    """Смена пароля из личного кабинета: проверяет текущий пароль, устанавливает новый."""
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")

    current_password = body.get("current_password") or ""
    new_password = body.get("new_password") or ""

    if not current_password or not new_password:
        return _err(400, "Заполните все поля")
    if len(new_password) < 6:
        return _err(400, "Новый пароль — не менее 6 символов")
    if len(new_password) > 128:
        return _err(400, "Слишком длинный пароль")

    current_hash = hash_password(current_password)
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT id FROM {SCHEMA}.users WHERE id = %s AND password_hash = %s",
            (user["id"], current_hash)
        )
        if not cur.fetchone():
            return _err(400, "Текущий пароль неверный")

        new_hash = hash_password(new_password)
        cur.execute(
            f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE id = %s",
            (new_hash, user["id"])
        )
        conn.commit()
        return _ok({"ok": True})
    finally:
        cur.close()
        conn.close()


def handle_forgot_password(body: dict) -> dict:
    """Восстановление пароля: генерирует новый пароль и отправляет на email."""
    email = sanitize_str(body.get("email") or "").lower()
    if not email or "@" not in email:
        return _err(400, "Введите корректный email")

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT id, name FROM {SCHEMA}.users WHERE email = %s", (email,))
        row = cur.fetchone()
        if not row:
            # Не раскрываем что пользователя нет — одинаковый ответ
            return _ok({"ok": True, "hint": "Если такой email зарегистрирован, на него отправлен новый пароль"})

        user_id, name = row
        # Генерируем новый пароль: 3 слога + 2 цифры, читаемый
        adjectives = ["Синий", "Красный", "Быстрый", "Умный", "Чёткий", "Новый"]
        nouns = ["Юрист", "Договор", "Закон", "Суд", "Право", "Иск"]
        import random
        new_password = f"{random.choice(adjectives)}{random.choice(nouns)}{random.randint(10, 99)}"
        pw_hash = hash_password(new_password)

        cur.execute(f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE id = %s", (pw_hash, user_id))
        conn.commit()
    finally:
        cur.close()
        conn.close()

    greeting = f"Здравствуйте{', ' + name if name and name != 'Пользователь' else ''}!"
    try:
        _send_email(
            to_email=email,
            subject="Юрист AI — восстановление пароля",
            body_text=(
                f"{greeting}\n\n"
                f"Ваш новый пароль для входа на сайт Юрист AI:\n\n"
                f"  {new_password}\n\n"
                f"После входа рекомендуем сменить пароль в личном кабинете.\n\n"
                f"Если вы не запрашивали восстановление пароля — немедленно войдите и смените пароль."
            )
        )
    except Exception as e:
        return _err(500, f"Ошибка отправки письма: {str(e)}")

    return _ok({"ok": True, "hint": "Если такой email зарегистрирован, на него отправлен новый пароль"})


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





def handle_report(token: str, body: dict) -> dict:
    """Сохраняет жалобу пользователя в БД (таблица reports)."""
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")

    message = sanitize_str(body.get("message") or "", max_len=2000)
    if not message:
        return _err(400, "Сообщение не может быть пустым")

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""INSERT INTO {SCHEMA}.reports (user_id, user_name, user_email, message)
                VALUES (%s, %s, %s, %s) RETURNING id""",
            (user["id"], user.get("name", ""), user.get("email", ""), message)
        )
        report_id = cur.fetchone()[0]
        conn.commit()
        try:
            _send_email(
                to_email=ADMIN_EMAIL,
                subject=f"Обращение #{report_id} от {user.get('email', '?')}",
                body_text=(
                    f"Новое обращение пользователя\n\n"
                    f"Имя: {user.get('name', '—')}\n"
                    f"Email: {user.get('email', '—')}\n"
                    f"ID обращения: {report_id}\n\n"
                    f"Сообщение:\n{message}"
                )
            )
        except Exception:
            pass
        return _ok({"ok": True, "report_id": report_id})
    except Exception as e:
        conn.rollback()
        return _err(500, str(e))
    finally:
        cur.close()
        conn.close()


def handle_admin_reports(token: str, body: dict) -> dict:
    """Получение списка репортов (только для админа)."""
    user = get_user_by_token(token)
    if not user or not user.get("isAdmin", False):
        return _err(403, "Доступ запрещён")

    action = body.get("sub_action", "list")
    conn = get_conn()
    cur = conn.cursor()
    try:
        if action == "list":
            status_filter = body.get("status_filter", "all")
            if status_filter == "all":
                cur.execute(
                    f"""SELECT id, user_id, user_name, user_email, message, status, admin_reply, replied_at, created_at
                        FROM {SCHEMA}.reports ORDER BY created_at DESC LIMIT 100"""
                )
            else:
                cur.execute(
                    f"""SELECT id, user_id, user_name, user_email, message, status, admin_reply, replied_at, created_at
                        FROM {SCHEMA}.reports WHERE status = %s ORDER BY created_at DESC LIMIT 100""",
                    (status_filter,)
                )
            rows = cur.fetchall()
            reports = []
            for r in rows:
                replied_at = r[7].isoformat() if r[7] else None
                created_at = r[8].isoformat() if r[8] else None
                reports.append({
                    "id": r[0], "user_id": r[1], "user_name": r[2], "user_email": r[3],
                    "message": r[4], "status": r[5], "admin_reply": r[6],
                    "replied_at": replied_at, "created_at": created_at
                })
            return _ok({"reports": reports})

        elif action == "reply":
            report_id = int(body.get("report_id", 0))
            reply_text = sanitize_str(body.get("reply", ""), max_len=2000)
            if not report_id or not reply_text:
                return _err(400, "Укажите report_id и reply")
            # Получаем email и сообщение пользователя для уведомления
            cur.execute(
                f"SELECT user_email, user_name, message FROM {SCHEMA}.reports WHERE id = %s",
                (report_id,)
            )
            report_row = cur.fetchone()
            cur.execute(
                f"""UPDATE {SCHEMA}.reports
                    SET admin_reply = %s, status = 'replied', replied_at = NOW()
                    WHERE id = %s""",
                (reply_text, report_id)
            )
            conn.commit()
            # Отправляем email-уведомление пользователю
            if report_row:
                user_email_to, user_name_to, _ = report_row
                try:
                    greeting = f"Здравствуйте, {user_name_to.strip()}!" if user_name_to and user_name_to.strip() else "Здравствуйте!"
                    _send_email(
                        to_email=user_email_to,
                        subject="Ответ на ваше обращение — ИИ-Право.рф",
                        body_text=(
                            f"{greeting}\n\n"
                            f"Юрист ответил на ваше обращение:\n\n"
                            f"{reply_text}\n\n"
                            f"---\n"
                            f"С уважением, команда ИИ-Право.рф\n"
                            f"Просмотреть переписку: https://ии-право.рф/cabinet"
                        )
                    )
                except Exception as e:
                    print(f"[REPORT_REPLY] Email не отправлен: {e}")
            return _ok({"ok": True})

        elif action == "close":
            report_id = int(body.get("report_id", 0))
            if not report_id:
                return _err(400, "Укажите report_id")
            cur.execute(
                f"UPDATE {SCHEMA}.reports SET status = 'closed' WHERE id = %s",
                (report_id,)
            )
            conn.commit()
            return _ok({"ok": True})

        elif action == "user_reports":
            # Пользователь смотрит свои репорты
            uid = int(body.get("target_user_id", 0))
            if not uid:
                return _err(400, "Укажите target_user_id")
            cur.execute(
                f"""SELECT id, user_id, user_name, user_email, message, status, admin_reply, replied_at, created_at
                    FROM {SCHEMA}.reports WHERE user_id = %s ORDER BY created_at DESC""",
                (uid,)
            )
            rows = cur.fetchall()
            reports = []
            for r in rows:
                replied_at = r[7].isoformat() if r[7] else None
                created_at = r[8].isoformat() if r[8] else None
                reports.append({
                    "id": r[0], "user_id": r[1], "user_name": r[2], "user_email": r[3],
                    "message": r[4], "status": r[5], "admin_reply": r[6],
                    "replied_at": replied_at, "created_at": created_at
                })
            return _ok({"reports": reports})

        return _err(400, "Неизвестный sub_action")
    except Exception as e:
        conn.rollback()
        return _err(500, str(e))
    finally:
        cur.close()
        conn.close()


def handle_my_reports(token: str) -> dict:
    """Возвращает репорты текущего пользователя (включая ответы администратора).
    При загрузке помечает отвеченные как прочитанные."""
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT id, user_id, user_name, user_email, message, status, admin_reply, replied_at, created_at, reply_seen
                FROM {SCHEMA}.reports WHERE user_id = %s ORDER BY created_at DESC""",
            (user["id"],)
        )
        rows = cur.fetchall()
        reports = []
        unseen_ids = []
        for r in rows:
            replied_at = r[7].isoformat() if r[7] else None
            created_at = r[8].isoformat() if r[8] else None
            reply_seen = r[9]
            # Собираем ID непрочитанных ответов
            if r[5] == "replied" and r[6] and not reply_seen:
                unseen_ids.append(r[0])
            reports.append({
                "id": r[0], "user_id": r[1], "user_name": r[2], "user_email": r[3],
                "message": r[4], "status": r[5], "admin_reply": r[6],
                "replied_at": replied_at, "created_at": created_at,
                "reply_seen": reply_seen,
            })
        # Помечаем как прочитанные
        if unseen_ids:
            cur.execute(
                f"UPDATE {SCHEMA}.reports SET reply_seen = TRUE WHERE id = ANY(%s)",
                (unseen_ids,)
            )
            conn.commit()
        return _ok({"reports": reports, "unseen_count": len(unseen_ids)})
    finally:
        cur.close()
        conn.close()


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
        "businessSubscriptionUntil": _fmt_dt(row[12]) if len(row) > 12 else None,
        "businessActionsLeft": row[13] if len(row) > 13 else 0,
        "businessOrgName": row[14] if len(row) > 14 else "",
        "referralCode": row[15] if len(row) > 15 else "",
    }


def _ok(data: dict) -> dict:
    return {"status": 200, "data": data}


def _err(code: int, msg: str) -> dict:
    return {"status": code, "error": msg}


# ─────────────────────────────────────────────
# Мессенджер: пользователь ↔ администратор
# ─────────────────────────────────────────────

def handle_lawyer_send(body: dict, user_id: int, is_admin: bool) -> dict:
    """Отправить сообщение юристу (пользователь) или пользователю (админ)."""
    msg_body = sanitize_str(body.get("body") or "")
    target_user_id = body.get("target_user_id")  # только для admin
    att_type = sanitize_str(body.get("attachment_type") or "")
    att_name = sanitize_str(body.get("attachment_name") or "")
    att_content = body.get("attachment_content") or ""

    if not msg_body and not att_content and not att_name:
        return _err(400, "Пустое сообщение")

    if is_admin:
        if not target_user_id:
            return _err(400, "Укажите target_user_id")
        sender = "admin"
        recipient_id = int(target_user_id)
    else:
        sender = "user"
        recipient_id = user_id

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"INSERT INTO {SCHEMA}.lawyer_messages "
            f"(user_id, sender, body, attachment_type, attachment_name, attachment_content) "
            f"VALUES (%s, %s, %s, %s, %s, %s) RETURNING id, created_at",
            (recipient_id, sender, msg_body, att_type or None, att_name or None, att_content or None)
        )
        row = cur.fetchone()
        conn.commit()

        # Получаем данные отправителя для письма
        sender_name = ""
        sender_email = ""
        if not is_admin:
            try:
                cur2 = conn.cursor()
                cur2.execute(f"SELECT name, email FROM {SCHEMA}.users WHERE id = %s", (user_id,))
                urow = cur2.fetchone()
                if urow:
                    sender_name = urow[0] or ""
                    sender_email = urow[1] or ""
                cur2.close()
            except Exception:
                pass
    finally:
        cur.close()
        conn.close()

    # Отправляем email юристу (только когда пишет пользователь, не админ)
    if not is_admin:
        try:
            att_info = f"\n\nПрикреплено: {att_name}" if att_name else ""
            email_body = (
                f"Новое сообщение от клиента\n"
                f"{'─'*40}\n"
                f"Имя: {sender_name}\n"
                f"Email: {sender_email}\n"
                f"{'─'*40}\n\n"
                f"{msg_body}{att_info}\n\n"
                f"{'─'*40}\n"
                f"Ответить можно через личный кабинет юриста на сайте ии-право.рф\n"
            )
            _send_email(
                to_email=ADMIN_EMAIL,
                subject=f"💬 Новое сообщение от {sender_name or sender_email or 'клиента'}",
                body_text=email_body,
            )
        except Exception:
            pass  # Email не критичен — сообщение уже сохранено

        # Push-уведомление администратору
        try:
            short_msg = (msg_body or att_name or "Новый запрос")[:80]
            _push_to_admin(
                title=f"💬 Новый запрос от {sender_name or sender_email or 'клиента'}",
                body=short_msg,
                url="/cabinet",
            )
        except Exception:
            pass

    else:
        # Админ ответил — email + push пользователю
        try:
            # Получаем email пользователя
            conn2 = get_conn()
            cur2 = conn2.cursor()
            try:
                cur2.execute(f"SELECT name, email FROM {SCHEMA}.users WHERE id = %s", (recipient_id,))
                urow2 = cur2.fetchone()
            finally:
                cur2.close()
                conn2.close()

            if urow2:
                recipient_name = urow2[0] or ""
                recipient_email = urow2[1] or ""
                greeting = f"Здравствуйте, {recipient_name.strip()}!" if recipient_name.strip() else "Здравствуйте!"
                att_info = f"\n\nПрикреплено: {att_name}" if att_name else ""
                _send_email(
                    to_email=recipient_email,
                    subject="⚖️ Юрист ответил на ваш запрос — ИИ-Право.рф",
                    body_text=(
                        f"{greeting}\n\n"
                        f"Юрист ответил на ваш запрос:\n\n"
                        f"{msg_body}{att_info}\n\n"
                        f"{'─'*40}\n"
                        f"Просмотреть переписку и продолжить диалог:\n"
                        f"https://ии-право.рф/cabinet\n\n"
                        f"С уважением, команда ИИ-Право.рф"
                    ),
                )
        except Exception as e:
            print(f"[LAWYER_REPLY] Email не отправлен: {e}")

    return _ok({"id": row[0], "created_at": row[1].isoformat()})


def handle_lawyer_messages(body: dict, user_id: int, is_admin: bool) -> dict:
    """Получить историю сообщений. Пользователь — свои; админ — all или по target_user_id."""
    target_user_id = body.get("target_user_id")
    limit = min(int(body.get("limit", 100)), 200)

    conn = get_conn()
    cur = conn.cursor()
    try:
        if is_admin:
            if target_user_id:
                cur.execute(
                    f"SELECT id, user_id, sender, body, attachment_type, attachment_name, is_read, created_at "
                    f"FROM {SCHEMA}.lawyer_messages WHERE user_id = %s ORDER BY created_at ASC LIMIT %s",
                    (int(target_user_id), limit)
                )
            else:
                # Список диалогов (последнее сообщение от каждого пользователя)
                cur.execute(
                    f"""SELECT DISTINCT ON (lm.user_id) lm.user_id, u.name, u.email,
                        lm.body, lm.sender, lm.created_at,
                        (SELECT COUNT(*) FROM {SCHEMA}.lawyer_messages WHERE user_id=lm.user_id AND sender='user' AND is_read=FALSE) as unread
                        FROM {SCHEMA}.lawyer_messages lm
                        JOIN {SCHEMA}.users u ON u.id = lm.user_id
                        ORDER BY lm.user_id, lm.created_at DESC"""
                )
                rows = cur.fetchall()
                return _ok({"dialogs": [
                    {"user_id": r[0], "name": r[1], "email": r[2],
                     "last_message": r[3], "last_sender": r[4],
                     "last_at": r[5].isoformat(), "unread": r[6]}
                    for r in rows
                ]})
        else:
            cur.execute(
                f"SELECT id, user_id, sender, body, attachment_type, attachment_name, is_read, created_at "
                f"FROM {SCHEMA}.lawyer_messages WHERE user_id = %s ORDER BY created_at ASC LIMIT %s",
                (user_id, limit)
            )
        rows = cur.fetchall()

        # Помечаем как прочитанные входящие сообщения
        if is_admin and target_user_id:
            cur.execute(
                f"UPDATE {SCHEMA}.lawyer_messages SET is_read=TRUE WHERE user_id=%s AND sender='user' AND is_read=FALSE",
                (int(target_user_id),)
            )
        elif not is_admin:
            cur.execute(
                f"UPDATE {SCHEMA}.lawyer_messages SET is_read=TRUE WHERE user_id=%s AND sender='admin' AND is_read=FALSE",
                (user_id,)
            )
        conn.commit()
    finally:
        cur.close()
        conn.close()

    return _ok({"messages": [
        {
            "id": r[0], "user_id": r[1], "sender": r[2],
            "body": r[3], "attachment_type": r[4],
            "attachment_name": r[5], "is_read": r[6],
            "created_at": r[7].isoformat(),
        }
        for r in rows
    ]})


# ─────────────────────────────────────────────
# Бизнес-раздел
# ─────────────────────────────────────────────

def handle_business_update_org(token: str, body: dict) -> dict:
    """Сохраняет название организации для бизнес-тарифа."""
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")
    org_name = sanitize_str(body.get("org_name") or "", max_len=200)
    if not org_name:
        return _err(400, "Укажите название организации")
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"UPDATE {SCHEMA}.users SET business_org_name = %s WHERE id = %s",
            (org_name, user["id"])
        )
        conn.commit()
        return _ok({"ok": True})
    finally:
        cur.close()
        conn.close()


def handle_business_consume_action(token: str) -> dict:
    """Списывает 1 бизнес-действие."""
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")
    if user.get("isAdmin"):
        return _ok({"ok": True})
    if (user.get("businessActionsLeft") or 0) <= 0:
        return _err(403, "Нет доступных действий в пакете")
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"UPDATE {SCHEMA}.users SET business_actions_left = business_actions_left - 1 WHERE id = %s AND business_actions_left > 0",
            (user["id"],)
        )
        conn.commit()
        return _ok({"ok": True})
    finally:
        cur.close()
        conn.close()


def handle_business_messages_get(token: str, body: dict) -> dict:
    """Получить историю бизнес-чата."""
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")
    limit = min(int(body.get("limit", 50)), 100)
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT id, role, body, created_at FROM {SCHEMA}.business_messages WHERE user_id = %s ORDER BY created_at ASC LIMIT %s",
            (user["id"], limit)
        )
        rows = cur.fetchall()
        return _ok({"messages": [
            {"id": r[0], "role": r[1], "body": r[2], "created_at": r[3].isoformat()}
            for r in rows
        ]})
    finally:
        cur.close()
        conn.close()


def handle_business_messages_save(token: str, body: dict) -> dict:
    """Сохранить сообщение бизнес-чата (user или ai)."""
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")
    role = body.get("role", "user")
    if role not in ("user", "ai"):
        return _err(400, "Неверная роль")
    msg_body = sanitize_str(body.get("body") or "", max_len=10000)
    if not msg_body:
        return _err(400, "Пустое сообщение")
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"INSERT INTO {SCHEMA}.business_messages (user_id, role, body) VALUES (%s, %s, %s) RETURNING id",
            (user["id"], role, msg_body)
        )
        conn.commit()
        return _ok({"ok": True})
    finally:
        cur.close()
        conn.close()


def handle_list_users(token: str) -> dict:
    """Возвращает список пользователей (только для админа)."""
    admin = get_user_by_token(token)
    if not admin or not admin.get("isAdmin", False):
        return _err(403, "Доступ запрещён")
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT id, email, name FROM {SCHEMA}.users ORDER BY id ASC LIMIT 500"
        )
        rows = cur.fetchall()
        return _ok({"users": [{"id": r[0], "email": r[1], "name": r[2] or ""} for r in rows]})
    finally:
        cur.close()
        conn.close()


def handle_get_billing_log(token: str, body: dict) -> dict:
    """Возвращает историю начислений для конкретного пользователя (только для админа)."""
    admin = get_user_by_token(token)
    if not admin or not admin.get("isAdmin", False):
        return _err(403, "Доступ запрещён")

    target_user_id = body.get("target_user_id")
    if not target_user_id:
        return _err(400, "Укажите target_user_id")

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT id, service_type, amount, description, source, payment_id, created_at
                FROM {SCHEMA}.billing_log
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT 100""",
            (int(target_user_id),)
        )
        rows = cur.fetchall()
        logs = []
        for r in rows:
            logs.append({
                "id": r[0],
                "service_type": r[1],
                "amount": float(r[2]) if r[2] else 0,
                "description": r[3],
                "source": r[4],
                "payment_id": r[5],
                "created_at": r[6].isoformat() if r[6] else None,
            })
        return _ok({"logs": logs})
    finally:
        cur.close()
        conn.close()


def handle_get_all_billing_log(token: str, body: dict) -> dict:
    """Все начисления всех пользователей — только для админа."""
    admin = get_user_by_token(token)
    if not admin or not admin.get("isAdmin", False):
        return _err(403, "Доступ запрещён")

    limit = int(body.get("limit", 100))
    offset = int(body.get("offset", 0))
    seen_ids = body.get("seen_ids", [])  # список id уже просмотренных записей

    conn = get_conn()
    cur = conn.cursor()
    try:
        # Исключаем просмотренные записи если указаны
        if seen_ids:
            placeholders = ",".join(["%s"] * len(seen_ids))
            cur.execute(
                f"""SELECT b.id, b.user_id, b.user_email, b.service_type, b.amount,
                           b.description, b.source, b.payment_id, b.created_at,
                           u.name
                    FROM {SCHEMA}.billing_log b
                    LEFT JOIN {SCHEMA}.users u ON u.id = b.user_id
                    WHERE b.id NOT IN ({placeholders})
                    ORDER BY b.created_at DESC
                    LIMIT %s OFFSET %s""",
                (*seen_ids, limit, offset)
            )
        else:
            cur.execute(
                f"""SELECT b.id, b.user_id, b.user_email, b.service_type, b.amount,
                           b.description, b.source, b.payment_id, b.created_at,
                           u.name
                    FROM {SCHEMA}.billing_log b
                    LEFT JOIN {SCHEMA}.users u ON u.id = b.user_id
                    ORDER BY b.created_at DESC
                    LIMIT %s OFFSET %s""",
                (limit, offset)
            )
        rows = cur.fetchall()
        logs = []
        for r in rows:
            logs.append({
                "id": r[0],
                "user_id": r[1],
                "user_email": r[2],
                "service_type": r[3],
                "amount": float(r[4]) if r[4] else 0,
                "description": r[5],
                "source": r[6],
                "payment_id": r[7],
                "created_at": r[8].isoformat() if r[8] else None,
                "user_name": r[9] or "",
            })

        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.billing_log")
        total = cur.fetchone()[0]

        return _ok({"logs": logs, "total": total})
    finally:
        cur.close()
        conn.close()


def handle_get_new_users(token: str, body: dict) -> dict:
    """Список пользователей с фильтром по дате — только для админа."""
    admin = get_user_by_token(token)
    if not admin or not admin.get("isAdmin", False):
        return _err(403, "Доступ запрещён")

    limit = int(body.get("limit", 50))
    seen_ids = body.get("seen_ids", [])

    conn = get_conn()
    cur = conn.cursor()
    try:
        if seen_ids:
            placeholders = ",".join(["%s"] * len(seen_ids))
            cur.execute(
                f"""SELECT id, email, name, phone, created_at,
                           paid_questions, paid_docs, is_admin
                    FROM {SCHEMA}.users
                    WHERE id NOT IN ({placeholders})
                    ORDER BY created_at DESC
                    LIMIT %s""",
                (*seen_ids, limit)
            )
        else:
            cur.execute(
                f"""SELECT id, email, name, phone, created_at,
                           paid_questions, paid_docs, is_admin
                    FROM {SCHEMA}.users
                    ORDER BY created_at DESC
                    LIMIT %s""",
                (limit,)
            )
        rows = cur.fetchall()
        users = []
        for r in rows:
            users.append({
                "id": r[0],
                "email": r[1],
                "name": r[2] or "",
                "phone": r[3] or "",
                "created_at": r[4].isoformat() if r[4] else None,
                "paid_questions": r[5] or 0,
                "paid_docs": r[6] or 0,
                "is_admin": r[7] or False,
            })

        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users")
        total = cur.fetchone()[0]

        return _ok({"users": users, "total": total})
    finally:
        cur.close()
        conn.close()


def handle_admin_search_user(token: str, body: dict) -> dict:
    """Поиск пользователя по email + полная информация (пакет, оплаты). Только для админа."""
    admin = get_user_by_token(token)
    if not admin or not admin.get("isAdmin", False):
        return _err(403, "Доступ запрещён")
    email_q = sanitize_str(body.get("email", ""), max_len=254).lower().strip()
    if not email_q or len(email_q) < 2:
        return _err(400, "Введите email для поиска")
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT id, email, name, phone, paid_questions, paid_docs, paid_expert,
                       paid_business, is_admin, created_at, last_login_at,
                       subscription_consult_until, subscription_docs_until,
                       business_subscription_until, business_actions_left
                FROM {SCHEMA}.users
                WHERE LOWER(email) LIKE %s
                ORDER BY created_at DESC LIMIT 10""",
            (f"%{email_q}%",)
        )
        rows = cur.fetchall()
        if not rows:
            return _ok({"users": []})
        users = []
        for r in rows:
            uid = r[0]
            # Оплаты пользователя
            cur.execute(
                f"""SELECT inv_id, service_type, amount, status, service_credited, created_at
                    FROM {SCHEMA}.orders WHERE user_id = %s OR LOWER(user_email) = LOWER(%s)
                    ORDER BY created_at DESC LIMIT 20""",
                (uid, r[1])
            )
            orders = [
                {"inv_id": o[0], "service_type": o[1], "amount": float(o[2] or 0),
                 "status": o[3], "credited": o[4],
                 "created_at": o[5].isoformat() if o[5] else None}
                for o in cur.fetchall()
            ]
            # Биллинг
            cur.execute(
                f"""SELECT service_type, amount, description, source, created_at
                    FROM {SCHEMA}.billing_log WHERE user_id = %s
                    ORDER BY created_at DESC LIMIT 20""",
                (uid,)
            )
            billing = [
                {"service_type": b[0], "amount": float(b[1] or 0),
                 "description": b[2], "source": b[3],
                 "created_at": b[4].isoformat() if b[4] else None}
                for b in cur.fetchall()
            ]
            users.append({
                "id": uid, "email": r[1], "name": r[2] or "", "phone": r[3] or "",
                "paid_questions": r[4] or 0, "paid_docs": r[5] or 0,
                "paid_expert": bool(r[6]), "paid_business": r[7] or 0,
                "is_admin": bool(r[8]),
                "created_at": r[9].isoformat() if r[9] else None,
                "last_login_at": r[10].isoformat() if r[10] else None,
                "subscription_consult_until": r[11].isoformat() if r[11] else None,
                "subscription_docs_until": r[12].isoformat() if r[12] else None,
                "business_subscription_until": r[13].isoformat() if r[13] else None,
                "business_actions_left": r[14] or 0,
                "orders": orders,
                "billing": billing,
            })
        return _ok({"users": users})
    finally:
        cur.close()
        conn.close()


def handle_admin_grant(token: str, body: dict) -> dict:
    """Начисление/списание вопросов, документов, тарифа пользователю — только для админа."""
    admin = get_user_by_token(token)
    if not admin or not admin.get("isAdmin", False):
        return _err(403, "Доступ запрещён")

    target_user_id = body.get("target_user_id")
    if not target_user_id:
        return _err(400, "Укажите target_user_id")
    target_user_id = int(target_user_id)

    # Поддерживаем дельту (положительную и отрицательную) и прямую установку
    questions_delta = int(body.get("questions", 0))   # +/- к текущему
    docs_delta = int(body.get("docs", 0))             # +/- к текущему
    set_questions = body.get("set_questions")          # установить точное значение
    set_docs = body.get("set_docs")                    # установить точное значение
    grant_service = sanitize_str(body.get("grant_service", ""), max_len=50)  # начислить тариф
    comment = sanitize_str(body.get("comment", "Ручное действие администратора"), max_len=200)

    if questions_delta == 0 and docs_delta == 0 and set_questions is None and set_docs is None and not grant_service:
        return _err(400, "Укажите изменение: вопросы, документы или тариф")

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT id, email, name, paid_questions, paid_docs FROM {SCHEMA}.users WHERE id = %s",
            (target_user_id,)
        )
        row = cur.fetchone()
        if not row:
            return _err(404, "Пользователь не найден")
        target_email = row[1]
        cur_q = row[3] or 0
        cur_d = row[4] or 0

        changes = []

        # Дельта вопросов
        if questions_delta != 0:
            new_q = max(0, cur_q + questions_delta)
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_questions = %s WHERE id = %s",
                (new_q, target_user_id)
            )
            sign = "+" if questions_delta > 0 else ""
            changes.append(f"{sign}{questions_delta} вопр. (итого {new_q})")
            cur.execute(
                f"""INSERT INTO {SCHEMA}.billing_log (user_id, user_email, service_type, amount, description, source)
                    VALUES (%s, %s, 'consultation', 0, %s, 'admin_grant')""",
                (target_user_id, target_email, f"{sign}{questions_delta} вопр. · {comment}")
            )

        # Прямая установка вопросов
        if set_questions is not None:
            sq = max(0, int(set_questions))
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_questions = %s WHERE id = %s",
                (sq, target_user_id)
            )
            changes.append(f"вопросов установлено: {sq}")
            cur.execute(
                f"""INSERT INTO {SCHEMA}.billing_log (user_id, user_email, service_type, amount, description, source)
                    VALUES (%s, %s, 'consultation', 0, %s, 'admin_grant')""",
                (target_user_id, target_email, f"Установлено {sq} вопр. · {comment}")
            )

        # Дельта документов
        if docs_delta != 0:
            new_d = max(0, cur_d + docs_delta)
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_docs = %s WHERE id = %s",
                (new_d, target_user_id)
            )
            sign = "+" if docs_delta > 0 else ""
            changes.append(f"{sign}{docs_delta} докум. (итого {new_d})")
            cur.execute(
                f"""INSERT INTO {SCHEMA}.billing_log (user_id, user_email, service_type, amount, description, source)
                    VALUES (%s, %s, 'document', 0, %s, 'admin_grant')""",
                (target_user_id, target_email, f"{sign}{docs_delta} докум. · {comment}")
            )

        # Прямая установка документов
        if set_docs is not None:
            sd = max(0, int(set_docs))
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_docs = %s WHERE id = %s",
                (sd, target_user_id)
            )
            changes.append(f"документов установлено: {sd}")
            cur.execute(
                f"""INSERT INTO {SCHEMA}.billing_log (user_id, user_email, service_type, amount, description, source)
                    VALUES (%s, %s, 'document', 0, %s, 'admin_grant')""",
                (target_user_id, target_email, f"Установлено {sd} докум. · {comment}")
            )

        # Начисление тарифа
        SERVICE_GRANTS = {
            "plan_starter":          ("paid_questions = paid_questions + 30, paid_docs = paid_docs + 5", "Пакет Старт: +30 вопр +5 докум"),
            "plan_starter_discount": ("paid_questions = paid_questions + 30, paid_docs = paid_docs + 5", "Пакет Старт (скидка): +30 вопр +5 докум"),
            "plan_pro":              ("paid_questions = paid_questions + 100, paid_docs = paid_docs + 20", "Тариф Профи: +100 вопр +20 докум"),
            "plan_max":              ("paid_questions = paid_questions + 300, paid_docs = paid_docs + 50, paid_expert = TRUE", "Тариф Максимум: +300 вопр +50 докум +юрист"),
            "document":              ("paid_docs = paid_docs + 1", "+1 документ"),
            "consultation":          ("paid_questions = paid_questions + 3", "+3 вопроса (консультация)"),
            "expert":                ("paid_expert = TRUE", "Доступ к юристу активирован"),
        }
        if grant_service:
            if grant_service not in SERVICE_GRANTS:
                return _err(400, f"Неизвестный тариф: {grant_service}")
            sql_set, desc = SERVICE_GRANTS[grant_service]
            cur.execute(
                f"UPDATE {SCHEMA}.users SET {sql_set} WHERE id = %s",
                (target_user_id,)
            )
            changes.append(desc)
            cur.execute(
                f"""INSERT INTO {SCHEMA}.billing_log (user_id, user_email, service_type, amount, description, source)
                    VALUES (%s, %s, %s, 0, %s, 'admin_grant')""",
                (target_user_id, target_email, grant_service, f"{desc} · {comment}")
            )

        conn.commit()

        # Возвращаем обновлённые данные пользователя
        cur.execute(
            f"SELECT paid_questions, paid_docs, paid_expert FROM {SCHEMA}.users WHERE id = %s",
            (target_user_id,)
        )
        upd = cur.fetchone()
        return _ok({
            "ok": True,
            "changes": changes,
            "paid_questions": upd[0] if upd else 0,
            "paid_docs": upd[1] if upd else 0,
            "paid_expert": bool(upd[2]) if upd else False,
        })
    except Exception as e:
        conn.rollback()
        return _err(500, str(e))
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Web Push уведомления
# ─────────────────────────────────────────────────────────────────────────────

def _get_vapid_claims():
    return {"sub": f"mailto:{ADMIN_EMAIL}"}


def _send_push_to_subscription(sub: dict, title: str, body: str, url: str = "/cabinet") -> bool:
    """Отправляет Web Push одной подписке. Возвращает True при успехе."""
    try:
        from pywebpush import webpush, WebPushException
        import json as _json
        vapid_private = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
        if not vapid_private:
            return False
        webpush(
            subscription_info={
                "endpoint": sub["endpoint"],
                "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
            },
            data=_json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=vapid_private,
            vapid_claims=_get_vapid_claims(),
            timeout=8,
        )
        return True
    except Exception as push_err:
        print(f"[PUSH] Ошибка отправки: {push_err}")
        return False


def _push_to_users(user_ids: list, title: str, body: str, url: str = "/cabinet"):
    """Отправляет push всем подпискам переданных user_id."""
    if not user_ids:
        return
    conn = get_conn()
    cur = conn.cursor()
    try:
        placeholders = ",".join(["%s"] * len(user_ids))
        cur.execute(
            f"SELECT id, endpoint, p256dh, auth FROM {SCHEMA}.push_subscriptions WHERE user_id IN ({placeholders})",
            user_ids,
        )
        rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    expired = []
    for row in rows:
        sub_id, endpoint, p256dh, auth = row
        ok = _send_push_to_subscription({"endpoint": endpoint, "p256dh": p256dh, "auth": auth}, title, body, url)
        if not ok:
            expired.append(sub_id)

    if expired:
        try:
            conn2 = get_conn()
            cur2 = conn2.cursor()
            placeholders2 = ",".join(["%s"] * len(expired))
            cur2.execute(f"UPDATE {SCHEMA}.push_subscriptions SET auth = 'expired' WHERE id IN ({placeholders2})", expired)
            conn2.commit()
            cur2.close()
            conn2.close()
        except Exception:
            pass


def _push_to_admin(title: str, body: str, url: str = "/cabinet"):
    """Отправляет push всем подпискам администраторов."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth FROM {SCHEMA}.push_subscriptions ps "
            f"JOIN {SCHEMA}.users u ON u.id = ps.user_id WHERE u.is_admin = TRUE AND ps.auth != 'expired'"
        )
        rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    for row in rows:
        _send_push_to_subscription({"endpoint": row[1], "p256dh": row[2], "auth": row[3]}, title, body, url)


def handle_push_subscribe(body: dict, user_id: int) -> dict:
    """Сохраняет Web Push подписку пользователя."""
    endpoint = sanitize_str(body.get("endpoint", ""), max_len=2048)
    p256dh = sanitize_str(body.get("p256dh", ""), max_len=512)
    auth_key = sanitize_str(body.get("auth", ""), max_len=256)

    if not endpoint or not p256dh or not auth_key:
        return _err(400, "Неполные данные подписки")

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""INSERT INTO {SCHEMA}.push_subscriptions (user_id, endpoint, p256dh, auth)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth""",
            (user_id, endpoint, p256dh, auth_key)
        )
        conn.commit()
        return _ok({"ok": True})
    except Exception as e:
        conn.rollback()
        return _err(500, str(e))
    finally:
        cur.close()
        conn.close()


def handle_push_subscribe_anon(body: dict) -> dict:
    """Сохраняет Web Push подписку анонимного пользователя (user_id=NULL)."""
    endpoint = sanitize_str(body.get("endpoint", ""), max_len=2048)
    p256dh = sanitize_str(body.get("p256dh", ""), max_len=512)
    auth_key = sanitize_str(body.get("auth", ""), max_len=256)

    if not endpoint or not p256dh or not auth_key:
        return _err(400, "Неполные данные подписки")

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""INSERT INTO {SCHEMA}.push_subscriptions (user_id, endpoint, p256dh, auth)
                VALUES (NULL, %s, %s, %s)
                ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth""",
            (endpoint, p256dh, auth_key)
        )
        conn.commit()
        return _ok({"ok": True})
    except Exception as e:
        conn.rollback()
        return _err(500, str(e))
    finally:
        cur.close()
        conn.close()


def handle_get_vapid_public_key() -> dict:
    """Возвращает публичный VAPID ключ для подписки на push."""
    key = os.environ.get("VAPID_PUBLIC_KEY", "")
    if not key:
        return _err(503, "Push уведомления не настроены")
    return _ok({"publicKey": key})


def log_compute(mode: str, duration_ms: int, tokens_requested: int = None):
    """Записывает расход вычислительного времени в БД. Не бросает исключений."""
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {SCHEMA}.compute_log (mode, duration_ms, tokens_requested) VALUES (%s, %s, %s)",
            (mode, duration_ms, tokens_requested)
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception:
        pass


def handle_get_compute_stats(token: str) -> dict:
    """Возвращает статистику вычислительного времени для админа."""
    admin = get_user_by_token(token)
    if not admin or not admin.get("is_admin"):
        return _err(403, "Доступ запрещён")
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(f"""
            SELECT
                SUM(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN duration_ms ELSE 0 END) AS last_hour_ms,
                SUM(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN duration_ms ELSE 0 END) AS today_ms,
                SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN duration_ms ELSE 0 END) AS week_ms,
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN 1 END) AS today_requests,
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 day' AND mode = 'doc_generate' THEN 1 END) AS today_docs,
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 day' AND mode = 'chat' THEN 1 END) AS today_chats
            FROM {SCHEMA}.compute_log
        """)
        row = cur.fetchone()
        last_hour_ms, today_ms, week_ms, today_requests, today_docs, today_chats = row

        cur.execute(f"""
            SELECT
                date_trunc('day', created_at)::date AS day,
                SUM(duration_ms) AS total_ms,
                COUNT(*) AS requests,
                COUNT(CASE WHEN mode = 'doc_generate' THEN 1 END) AS docs,
                COUNT(CASE WHEN mode = 'chat' THEN 1 END) AS chats
            FROM {SCHEMA}.compute_log
            WHERE created_at >= NOW() - INTERVAL '14 days'
            GROUP BY 1
            ORDER BY 1 DESC
        """)
        days = [
            {"day": str(r[0]), "total_sec": round((r[1] or 0) / 1000, 1), "requests": r[2], "docs": r[3], "chats": r[4]}
            for r in cur.fetchall()
        ]

        cur.execute(f"""
            SELECT mode, COUNT(*) as cnt, ROUND(AVG(duration_ms)) as avg_ms
            FROM {SCHEMA}.compute_log
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY mode ORDER BY cnt DESC
        """)
        by_mode = [{"mode": r[0], "count": r[1], "avg_sec": round((r[2] or 0) / 1000, 1)} for r in cur.fetchall()]

        return _ok({
            "last_hour_sec": round((last_hour_ms or 0) / 1000, 1),
            "today_sec": round((today_ms or 0) / 1000, 1),
            "week_sec": round((week_ms or 0) / 1000, 1),
            "today_requests": today_requests or 0,
            "today_docs": today_docs or 0,
            "today_chats": today_chats or 0,
            "days": days,
            "by_mode": by_mode,
        })
    finally:
        cur.close()
        conn.close()