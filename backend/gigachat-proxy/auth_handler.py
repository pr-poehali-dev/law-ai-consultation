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
    "subscription_consult_until, subscription_docs_until, "
    "business_subscription_until, business_actions_left, business_org_name, referral_code"
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


def _normalize_phone(phone: str) -> str:
    """Нормализует телефон: оставляет только цифры, приводит к формату 7XXXXXXXXXX."""
    digits = re.sub(r'\D', '', phone)
    if len(digits) == 11 and digits[0] in ('7', '8'):
        return '7' + digits[1:]
    if len(digits) == 10:
        return '7' + digits
    return digits


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

        # 3 бесплатных вопроса всем новым пользователям при регистрации
        trial_questions = 0 if is_admin else 3

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
            f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
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
        # Один сеанс на пользователя — инвалидируем все предыдущие сессии
        cur.execute(
            f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE user_id = %s AND expires_at > NOW()",
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
        elif service_type == "plan_starter":
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
        elif service_type == "plan_max":
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET paid_questions = paid_questions + 300,
                        paid_docs = paid_docs + 50
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
            cur.execute(
                f"""UPDATE {SCHEMA}.reports
                    SET admin_reply = %s, status = 'replied', replied_at = NOW()
                    WHERE id = %s""",
                (reply_text, report_id)
            )
            conn.commit()
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
    """Возвращает репорты текущего пользователя (включая ответы администратора)."""
    user = get_user_by_token(token)
    if not user:
        return _err(401, "Не авторизован")

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT id, user_id, user_name, user_email, message, status, admin_reply, replied_at, created_at
                FROM {SCHEMA}.reports WHERE user_id = %s ORDER BY created_at DESC""",
            (user["id"],)
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


def handle_admin_grant(token: str, body: dict) -> dict:
    """Ручное начисление вопросов/документов пользователю — только для админа."""
    admin = get_user_by_token(token)
    if not admin or not admin.get("isAdmin", False):
        return _err(403, "Доступ запрещён")

    target_user_id = int(body.get("target_user_id", 0))
    questions = int(body.get("questions", 0))
    docs = int(body.get("docs", 0))
    comment = sanitize_str(body.get("comment", "Ручное начисление от администратора"), max_len=200)

    if not target_user_id:
        return _err(400, "Укажите target_user_id")
    if questions < 0 or docs < 0:
        return _err(400, "Значения не могут быть отрицательными")
    if questions == 0 and docs == 0:
        return _err(400, "Укажите количество вопросов или документов")

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT id, email, name FROM {SCHEMA}.users WHERE id = %s",
            (target_user_id,)
        )
        row = cur.fetchone()
        if not row:
            return _err(404, "Пользователь не найден")
        target_email = row[1]

        if questions > 0:
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + %s WHERE id = %s",
                (questions, target_user_id)
            )
            cur.execute(
                f"""INSERT INTO {SCHEMA}.billing_log (user_id, user_email, service_type, amount, description, source)
                    VALUES (%s, %s, 'consultation', 0, %s, 'admin_grant')""",
                (target_user_id, target_email, f"+{questions} вопр. · {comment}")
            )

        if docs > 0:
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_docs = paid_docs + %s WHERE id = %s",
                (docs, target_user_id)
            )
            cur.execute(
                f"""INSERT INTO {SCHEMA}.billing_log (user_id, user_email, service_type, amount, description, source)
                    VALUES (%s, %s, 'document', 0, %s, 'admin_grant')""",
                (target_user_id, target_email, f"+{docs} докум. · {comment}")
            )

        conn.commit()
        return _ok({"ok": True, "questions_added": questions, "docs_added": docs})
    except Exception as e:
        conn.rollback()
        return _err(500, str(e))
    finally:
        cur.close()
        conn.close()