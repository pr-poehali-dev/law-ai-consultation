"""Сервис юриста: переписка пользователей с юристом, загрузка файлов, управление диалогами. push: raw base64url keys."""
import json
import os
import re
import smtplib
import psycopg2
from datetime import datetime
from email.mime.text import MIMEText
from email.header import Header

# ─────────────────────────────────────────────
# Константы
# ─────────────────────────────────────────────

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")
ADMIN_EMAIL = "ilya.povarchuk@mail.ru"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

_SELECT_COLS = (
    "id, email, name, phone, free_questions_used, paid_questions, "
    "paid_docs, paid_expert, paid_business, is_admin, "
    "subscription_consult_until, subscription_docs_until, "
    "business_subscription_until, business_actions_left, business_org_name, referral_code, "
    "lawyer_questions_left, has_file_analysis, purchased_plan, lawyer_consultations_left"
)

# ─────────────────────────────────────────────
# Вспомогательные функции
# ─────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(
        os.environ["DATABASE_URL"],
        connect_timeout=3,              # БД локальная — 3с достаточно
        options="-c statement_timeout=5000",  # 5с — таймаут функции 10с, запас на остальное
    )


def sanitize_str(s: str, max_len: int = 255) -> str:
    if not s:
        return ""
    # Удаляем управляющие символы кроме \n (0x0a) и \t (0x09) — они нужны в теле сообщений
    cleaned = re.sub(r'[\x00-\x08\x0b-\x1f\x7f]', '', str(s))
    return cleaned[:max_len].strip()


def _ok(data: dict) -> dict:
    return {"status": 200, "data": data}


def _err(code: int, msg: str) -> dict:
    return {"status": code, "error": msg}


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
        "lawyerQuestionsLeft": row[16] if len(row) > 16 else 0,
        "hasFileAnalysis": bool(row[17]) if len(row) > 17 else False,
        "purchasedPlan": row[18] if len(row) > 18 else None,
        "lawyerConsultationsLeft": row[19] if len(row) > 19 else 0,
    }


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
        with smtplib.SMTP_SSL("smtp.yandex.ru", 465, timeout=8) as server:
            server.login(smtp_from, smtp_pass)
            server.sendmail(smtp_from, [to_email], msg.as_string())
        return  # успех
    except Exception as e:
        last_err = f"SSL-465: {e}"

    # Попытка 2: STARTTLS 587
    try:
        with smtplib.SMTP("smtp.yandex.ru", 587, timeout=8) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_from, smtp_pass)
            server.sendmail(smtp_from, [to_email], msg.as_string())
        return  # успех
    except Exception as e:
        last_err = f"{last_err} | STARTTLS-587: {e}"

    raise RuntimeError(f"Не удалось отправить письмо: {last_err}")


def _get_vapid_claims():
    return {"sub": f"mailto:{ADMIN_EMAIL}"}


def _send_push_to_subscription(sub: dict, title: str, body: str, url: str = "/cabinet", tag: str = "ii-pravo") -> bool:
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
            data=_json.dumps({"title": title, "body": body, "url": url, "tag": tag}),
            vapid_private_key=vapid_private,
            vapid_claims=_get_vapid_claims(),
            timeout=4,  # 4с достаточно для FCM/APNs; 8с слишком много при синхронном вызове
        )
        return True
    except Exception as push_err:
        print(f"[PUSH] Ошибка отправки: {push_err}")
        return False


def _push_to_admin(title: str, body: str, url: str = "/cabinet", tag: str = "ii-pravo"):
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
        _send_push_to_subscription({"endpoint": row[1], "p256dh": row[2], "auth": row[3]}, title, body, url, tag)


def _push_to_users(user_ids: list, title: str, body: str, url: str = "/cabinet", tag: str = "ii-pravo"):
    """Отправляет push конкретным пользователям. Помечает истёкшие подписки."""
    if not user_ids:
        return
    conn = get_conn()
    cur = conn.cursor()
    try:
        placeholders = ",".join(["%s"] * len(user_ids))
        # Берём только 2 последних подписки на пользователя — экономим вычислительное время
        # У пользователя обычно 1-2 устройства, старые дублируются не нужны
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
        ok = _send_push_to_subscription({"endpoint": endpoint, "p256dh": p256dh, "auth": auth}, title, body, url, tag)
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


# ─────────────────────────────────────────────
# Мессенджер: пользователь ↔ администратор
# ─────────────────────────────────────────────

def handle_lawyer_send(body: dict, user_id: int, is_admin: bool) -> dict:
    """Отправить сообщение юристу (пользователь) или пользователю (админ)."""
    msg_body = sanitize_str(body.get("body") or "", max_len=5000)
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
    lawyer_questions_left = None
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

    # Email и push — запускаем в фоновых потоках, не блокируем ответ пользователю
    if not is_admin:
        # Пользователь написал юристу → уведомляем админа
        def _notify_admin():
            try:
                att_info = f"\n\nПрикреплено: {att_name}" if att_name else ""
                _send_email(
                    to_email=ADMIN_EMAIL,
                    subject=f"💬 Новое сообщение от {sender_name or sender_email or 'клиента'}",
                    body_text=(
                        f"Новое сообщение от клиента\n{'─'*40}\n"
                        f"Имя: {sender_name}\nEmail: {sender_email}\n{'─'*40}\n\n"
                        f"{msg_body}{att_info}\n\n{'─'*40}\n"
                        f"Ответить можно через личный кабинет юриста на сайте ии-право.рф\n"
                    ),
                )
            except Exception:
                pass
            try:
                short_msg = (msg_body or att_name or "Новое сообщение")[:100]
                name_label = sender_name.strip() if sender_name.strip() else (sender_email or "Клиент")
                _push_to_admin(
                    title=f"💬 {name_label} — ИИ-Право.рф",
                    body=short_msg,
                    url="/cabinet",
                    tag="lawyer-inbox",
                )
            except Exception:
                pass
        threading.Thread(target=_notify_admin, daemon=True).start()

    else:
        # Админ ответил → уведомляем пользователя
        def _notify_user():
            try:
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
                            f"{greeting}\n\nЮрист ответил на ваш запрос:\n\n"
                            f"{msg_body}{att_info}\n\n{'─'*40}\n"
                            f"Просмотреть переписку и продолжить диалог:\nhttps://ии-право.рф/cabinet\n\n"
                            f"С уважением, команда ИИ-Право.рф"
                        ),
                    )
            except Exception as e:
                print(f"[LAWYER_REPLY] Email не отправлен: {e}")
            try:
                short_msg = (msg_body or att_name or "Посмотрите ответ в личном кабинете")[:100]
                _push_to_users(
                    [recipient_id],
                    title="⚖️ Юрист ответил — ИИ-Право.рф",
                    body=short_msg,
                    url="/cabinet?tab=expert",
                    tag="lawyer-reply",
                )
            except Exception as e:
                print(f"[LAWYER_REPLY] Push не отправлен: {e}")
        threading.Thread(target=_notify_user, daemon=True).start()

    result = {"id": row[0], "created_at": row[1].isoformat()}
    return _ok(result)


def handle_lawyer_ping(body: dict, user_id: int, is_admin: bool) -> dict:
    """Лёгкий ping — возвращает только last_id и unread_count без загрузки тела сообщений.
    Используется для быстрого поллинга (каждые 3с) когда пользователь на вкладке Юрист.
    Если last_id изменился — фронтенд делает полный lawyer-messages запрос."""
    target_user_id = body.get("target_user_id")
    known_last_id = body.get("last_id", 0)

    conn = get_conn()
    cur = conn.cursor()
    try:
        if is_admin:
            if target_user_id:
                # Пинг конкретного диалога — проверяем появились ли новые сообщения
                cur.execute(
                    f"SELECT MAX(id), COUNT(*) FILTER (WHERE sender='user' AND is_read=FALSE) "
                    f"FROM {SCHEMA}.lawyer_messages WHERE user_id = %s",
                    (int(target_user_id),)
                )
                row = cur.fetchone()
                last_id = row[0] or 0
                unread = int(row[1] or 0)
            else:
                # Пинг списка диалогов — проверяем появились ли новые сообщения от любого юзера
                cur.execute(
                    f"SELECT MAX(id), COUNT(*) FILTER (WHERE sender='user' AND is_read=FALSE) "
                    f"FROM {SCHEMA}.lawyer_messages"
                )
                row = cur.fetchone()
                last_id = row[0] or 0
                unread = int(row[1] or 0)
        else:
            cur.execute(
                f"SELECT MAX(id), COUNT(*) FILTER (WHERE sender='admin' AND is_read=FALSE) "
                f"FROM {SCHEMA}.lawyer_messages WHERE user_id = %s",
                (user_id,)
            )
            row = cur.fetchone()
            last_id = row[0] or 0
            unread = int(row[1] or 0)
    finally:
        cur.close()
        conn.close()

    return _ok({
        "last_id": last_id,
        "unread": unread,
        "has_new": last_id > known_last_id,
    })


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
                    f"SELECT id, user_id, sender, body, attachment_type, attachment_name, attachment_content, is_read, created_at "
                    f"FROM {SCHEMA}.lawyer_messages WHERE user_id = %s ORDER BY created_at ASC LIMIT %s",
                    (int(target_user_id), limit)
                )
            else:
                # Список диалогов (последнее сообщение от каждого пользователя)
                show_closed = body.get("show_closed", False)
                closed_filter = "" if show_closed else "AND lm.is_closed IS NOT TRUE"
                cur.execute(
                    f"""SELECT DISTINCT ON (lm.user_id) lm.user_id, u.name, u.email,
                        lm.body, lm.sender, lm.created_at,
                        (SELECT COUNT(*) FROM {SCHEMA}.lawyer_messages WHERE user_id=lm.user_id AND sender='user' AND is_read=FALSE) as unread,
                        (SELECT bool_or(is_closed) FROM {SCHEMA}.lawyer_messages WHERE user_id=lm.user_id) as is_closed,
                        u.lawyer_consultations_left,
                        u.purchased_plan
                        FROM {SCHEMA}.lawyer_messages lm
                        JOIN {SCHEMA}.users u ON u.id = lm.user_id
                        {closed_filter}
                        ORDER BY lm.user_id, lm.created_at DESC"""
                )
                rows = cur.fetchall()
                return _ok({"dialogs": [
                    {"user_id": r[0], "name": r[1], "email": r[2],
                     "last_message": r[3], "last_sender": r[4],
                     "last_at": r[5].isoformat(), "unread": int(r[6]), "is_closed": bool(r[7]),
                     "lawyer_consultations_left": r[8] if r[8] is not None else 0,
                     "purchased_plan": r[9]}
                    for r in rows
                ]})
        else:
            cur.execute(
                f"SELECT id, user_id, sender, body, attachment_type, attachment_name, attachment_content, is_read, created_at "
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
            "attachment_name": r[5], "attachment_content": r[6], "is_read": r[7],
            "created_at": r[8].isoformat(),
        }
        for r in rows
    ]})


def handle_lawyer_close_dialog(body: dict, user_id: int, is_admin: bool) -> dict:
    """Скрыть диалог из списка (только для админа). Не списывает консультацию."""
    if not is_admin:
        return _err(403, "Нет доступа")
    target_user_id = body.get("target_user_id")
    if not target_user_id:
        return _err(400, "Укажите target_user_id")
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"UPDATE {SCHEMA}.lawyer_messages SET is_closed=TRUE WHERE user_id=%s",
            (int(target_user_id),)
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()
    return _ok({"closed": True})


def handle_lawyer_complete_consultation(body: dict, user_id: int, is_admin: bool) -> dict:
    """Завершить консультацию (только для админа): закрыть диалог + списать 1 консультацию у пользователя."""
    if not is_admin:
        return _err(403, "Нет доступа")
    target_user_id = body.get("target_user_id")
    if not target_user_id:
        return _err(400, "Укажите target_user_id")
    tid = int(target_user_id)
    conn = get_conn()
    cur = conn.cursor()
    try:
        # Закрываем диалог
        cur.execute(
            f"UPDATE {SCHEMA}.lawyer_messages SET is_closed=TRUE WHERE user_id=%s",
            (tid,)
        )
        # Списываем 1 консультацию (не ниже 0)
        cur.execute(
            f"""UPDATE {SCHEMA}.users
                SET lawyer_consultations_left = GREATEST(0, lawyer_consultations_left - 1)
                WHERE id=%s
                RETURNING lawyer_consultations_left""",
            (tid,)
        )
        row = cur.fetchone()
        consultations_left = row[0] if row else 0
        conn.commit()
    finally:
        cur.close()
        conn.close()

    # Push пользователю о завершении консультации
    try:
        left_text = (
            f"Осталось {consultations_left} консульт. · Спасибо за обращение!"
            if consultations_left > 0
            else "Консультации исчерпаны · Можно продлить в кабинете"
        )
        _push_to_users(
            [tid],
            title="✅ Консультация завершена — ИИ-Право.рф",
            body=left_text,
            url="/cabinet?tab=expert",
            tag="lawyer-complete",
        )
    except Exception as e:
        print(f"[LAWYER_COMPLETE] Push не отправлен: {e}")

    return _ok({"completed": True, "consultations_left": consultations_left})


def handle_lawyer_complete_service(token: str, body: dict) -> dict:
    """Завершить услугу живого юриста для пользователя (только для админа)."""
    admin = get_user_by_token(token)
    if not admin or not admin.get("is_admin"):
        return _err(403, "Нет доступа")
    target_user_id = body.get("target_user_id")
    service_type = body.get("service_type", "paid_expert")
    if not target_user_id:
        return _err(400, "Укажите target_user_id")
    conn = get_conn()
    cur = conn.cursor()
    try:
        if service_type == "paid_expert":
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_expert=FALSE WHERE id=%s",
                (int(target_user_id),)
            )
        elif service_type == "subscription_consult":
            cur.execute(
                f"UPDATE {SCHEMA}.users SET subscription_consult_until=NOW() WHERE id=%s",
                (int(target_user_id),)
            )
        conn.commit()
    finally:
        cur.close()
        conn.close()
    return _ok({"completed": True, "service_type": service_type})


def handle_lawyer_upload_file(body: dict, user_id: int) -> dict:
    """Загрузка файла пользователем для юриста. Хранится 24 часа в S3."""
    import base64, time
    import boto3
    file_b64 = body.get("file", "")
    filename = sanitize_str(body.get("filename", "document"), max_len=200)
    if not file_b64:
        return _err(400, "Файл обязателен")
    try:
        file_data = base64.b64decode(file_b64)
    except Exception:
        return _err(400, "Некорректный base64")
    if len(file_data) > 20 * 1024 * 1024:
        return _err(400, "Файл слишком большой (макс. 20 МБ)")
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    allowed = {"pdf", "docx", "doc", "jpg", "jpeg", "png", "txt"}
    if ext not in allowed:
        return _err(400, "Недопустимый формат файла")
    mime_map = {
        "pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc": "application/msword", "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "png": "image/png", "txt": "text/plain",
    }
    content_type = mime_map.get(ext, "application/octet-stream")
    ts = int(time.time())
    key = f"lawyer-files/{ts}_{user_id}_{filename}"
    from botocore.config import Config as BotoConfig
    s3 = boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        config=BotoConfig(connect_timeout=5, read_timeout=20),  # 20с на upload до 20МБ
    )
    s3.put_object(Bucket="files", Key=key, Body=file_data, ContentType=content_type,
                  Metadata={"uploaded_at": str(ts), "user_id": str(user_id), "ttl": str(ts + 86400)})
    project_id = os.environ["AWS_ACCESS_KEY_ID"]
    cdn_url = f"https://cdn.poehali.dev/projects/{project_id}/bucket/{key}"
    return _ok({"url": cdn_url, "key": key, "filename": filename, "expires_at": ts + 86400})


def handle_lawyer_cleanup_files(token: str) -> dict:
    """Удалить файлы юриста старше 24 часов из S3 (только для админа)."""
    import time
    import boto3
    admin = get_user_by_token(token)
    if not admin or not admin.get("is_admin"):
        return _err(403, "Нет доступа")
    s3 = boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )
    now = int(time.time())
    deleted = []
    try:
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket="files", Prefix="lawyer-files/"):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                basename = key.replace("lawyer-files/", "")
                parts = basename.split("_", 1)
                try:
                    uploaded_at = int(parts[0])
                    if now - uploaded_at >= 86400:
                        s3.delete_object(Bucket="files", Key=key)
                        deleted.append(key)
                except (ValueError, IndexError):
                    pass
    except Exception:
        pass
    return _ok({"deleted": len(deleted)})


# ─────────────────────────────────────────────
# Главный обработчик
# ─────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Lawyer-service: переписка пользователей с юристом, загрузка файлов, управление диалогами."""

    # OPTIONS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    # GET keep-alive
    if event.get("httpMethod") == "GET":
        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"ok": True, "service": "lawyer-service"}, ensure_ascii=False),
        }

    # Парсим тело запроса
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    # Токен из заголовков
    headers = event.get("headers") or {}
    token = headers.get("X-Auth-Token") or headers.get("x-auth-token", "")

    action = sanitize_str(body.get("action") or "", max_len=64)

    def _json_response(status: int, data: dict) -> dict:
        return {
            "statusCode": status,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False),
        }

    def _result_response(result: dict) -> dict:
        status = result.get("status", 200)
        if "error" in result:
            return _json_response(status, {"error": result["error"]})
        return _json_response(200, result.get("data", {}))

    # Действия требующие авторизации через токен
    TOKEN_REQUIRED_ACTIONS = {
        "lawyer-send",
        "lawyer-messages",
        "lawyer-ping",
        "lawyer-close-dialog",
        "lawyer-complete-consultation",
        "lawyer-upload-file",
    }

    if action in TOKEN_REQUIRED_ACTIONS:
        user = get_user_by_token(token)
        if not user:
            return _json_response(401, {"error": "Не авторизован"})

        user_id = user.get("id")
        is_admin = bool(user.get("isAdmin", False))

        if action == "lawyer-send":
            return _result_response(handle_lawyer_send(body, user_id, is_admin))

        if action == "lawyer-messages":
            return _result_response(handle_lawyer_messages(body, user_id, is_admin))

        if action == "lawyer-ping":
            return _result_response(handle_lawyer_ping(body, user_id, is_admin))

        if action == "lawyer-close-dialog":
            return _result_response(handle_lawyer_close_dialog(body, user_id, is_admin))

        if action == "lawyer-complete-consultation":
            return _result_response(handle_lawyer_complete_consultation(body, user_id, is_admin))

        if action == "lawyer-upload-file":
            return _result_response(handle_lawyer_upload_file(body, user_id))

    # Действия с токеном внутри хендлера (проверяют сами)
    if action == "lawyer-complete-service":
        return _result_response(handle_lawyer_complete_service(token, body))

    if action == "lawyer-cleanup-files":
        return _result_response(handle_lawyer_cleanup_files(token))

    # Неизвестный action
    return _json_response(400, {"error": "Неизвестное действие"})