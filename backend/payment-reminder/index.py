"""
Cloud Function: напоминание об активации тарифа.
Ищет ордера со статусом paid + service_credited=FALSE (пользователь не зарегистрировался)
созданные от 10 минут до 24 часов назад — отправляет письмо со ссылкой на регистрацию.
Запускается по расписанию или вручную через POST.
"""
import os
import json
import smtplib
import psycopg2
from email.mime.text import MIMEText
from email.header import Header

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")
SITE_URL = "https://xn--e1afmkfd5b.xn--p1ai/"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

SERVICE_DESCRIPTIONS = {
    "consultation":          "Консультация живого юриста",
    "document":              "1 юридический документ",
    "expert":                "Экспертная проверка юристом",
    "business":              "Бизнес-пакет",
    "subscription_consult":  "Подписка: консультации 31 день",
    "subscription_docs":     "Подписка: документы 31 день",
    "plan_starter":          "Пакет Старт — 30 вопросов + 5 документов",
    "plan_starter_discount": "Пакет Старт (скидка 50%) — 30 вопросов + 5 документов",
    "plan_pro":              "Тариф Профи — 100 вопросов + 20 документов",
    "plan_max":              "Тариф Максимум — 300 вопросов + 50 документов + юрист",
    "plan_max_expert":       "Тариф Максимум — 300 вопросов + 50 документов + юрист",
    "business_subscription": "Бизнес-подписка — 150 действий / 31 день",
    "business_actions_10":   "+10 бизнес-действий",
    "business_actions_30":   "+30 бизнес-действий",
    "business_actions_50":   "+50 бизнес-действий",
    "business_actions_60":   "+60 бизнес-действий",
    "business_actions_150":  "+150 бизнес-действий",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _send_email(to_email: str, subject: str, body_text: str) -> None:
    smtp_from = os.environ.get("SMTP_FROM_EMAIL", "").strip()
    smtp_pass = os.environ.get("SMTP_PASSWORD", "").strip()
    if not smtp_from or not smtp_pass:
        raise RuntimeError("SMTP не настроен")

    msg = MIMEText(body_text, "plain", "utf-8")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = smtp_from
    msg["To"] = to_email

    last_err = None
    try:
        with smtplib.SMTP_SSL("smtp.yandex.ru", 465, timeout=15) as server:
            server.login(smtp_from, smtp_pass)
            server.sendmail(smtp_from, [to_email], msg.as_string())
        return
    except Exception as e:
        last_err = f"SSL-465: {e}"

    try:
        with smtplib.SMTP("smtp.yandex.ru", 587, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_from, smtp_pass)
            server.sendmail(smtp_from, [to_email], msg.as_string())
        return
    except Exception as e:
        last_err = f"{last_err} | STARTTLS-587: {e}"

    raise RuntimeError(f"Не удалось отправить: {last_err}")


def build_email_body(service_type: str, amount: float) -> str:
    desc = SERVICE_DESCRIPTIONS.get(service_type, service_type)
    return f"""Здравствуйте!

Ваш платёж успешно принят, но тариф ещё не активирован — для этого нужно зарегистрироваться.

Что вы купили:
  {desc}
  Сумма: {int(amount)} ₽

Чтобы активировать тариф, перейдите по ссылке и зарегистрируйтесь:
  {SITE_URL}

После регистрации с тем же email, который вы указали при оплате, тариф активируется автоматически.

Если возникли вопросы — напишите нам в поддержку на сайте.

С уважением,
Команда ИИ-Право.рф"""


def get_orders_needing_reminder(conn) -> list:
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT inv_id, user_email, service_type, amount
                FROM {SCHEMA}.orders
                WHERE status = 'paid'
                  AND service_credited = FALSE
                  AND created_at < NOW() - INTERVAL '10 minutes'
                  AND created_at > NOW() - INTERVAL '24 hours'
                  AND reminder_sent_at IS NULL
                  AND user_email IS NOT NULL
                  AND user_email != ''
                ORDER BY created_at ASC
                LIMIT 50"""
        )
        rows = cur.fetchall()
        return [
            {"inv_id": r[0], "user_email": r[1], "service_type": r[2], "amount": float(r[3] or 0)}
            for r in rows
        ]
    finally:
        cur.close()


def mark_reminder_sent(conn, inv_id: int):
    cur = conn.cursor()
    try:
        cur.execute(
            f"UPDATE {SCHEMA}.orders SET reminder_sent_at = NOW() WHERE inv_id = %s",
            (inv_id,)
        )
        conn.commit()
    finally:
        cur.close()


def send_manual_to_emails(conn, emails: list) -> dict:
    """Отправляет письма конкретным email-адресам (для ручной отправки)."""
    cur = conn.cursor()
    sent = 0
    errors = []
    try:
        for email in emails:
            cur.execute(
                f"""SELECT inv_id, service_type, amount FROM {SCHEMA}.orders
                    WHERE LOWER(user_email) = LOWER(%s) AND status = 'paid'
                    ORDER BY created_at DESC LIMIT 1""",
                (email,)
            )
            row = cur.fetchone()
            if not row:
                errors.append(f"{email}: ордер не найден")
                continue
            inv_id, service_type, amount = row
            try:
                body = build_email_body(service_type, float(amount or 0))
                _send_email(email, "Вы оплатили тариф — осталось зарегистрироваться", body)
                cur.execute(
                    f"UPDATE {SCHEMA}.orders SET reminder_sent_at = NOW() WHERE inv_id = %s",
                    (inv_id,)
                )
                conn.commit()
                sent += 1
                print(f"[REMINDER] Письмо отправлено → {email}")
            except Exception as e:
                errors.append(f"{email}: {e}")
    finally:
        cur.close()
    return {"sent": sent, "errors": errors}


def handler(event: dict, context) -> dict:
    """Отправляет напоминания о регистрации пользователям, оплатившим тариф."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    conn = get_conn()
    try:
        # Ручная отправка конкретным адресам
        manual_emails = body.get("emails")
        if manual_emails and isinstance(manual_emails, list):
            result = send_manual_to_emails(conn, manual_emails)
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"ok": True, **result}, ensure_ascii=False),
            }

        # Автоматический режим — ищем все нуждающиеся ордера
        orders = get_orders_needing_reminder(conn)
        if not orders:
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"ok": True, "emails_sent": 0, "message": "Нет ордеров для напоминания"}),
            }

        sent = 0
        errors = []
        for order in orders:
            try:
                body_text = build_email_body(order["service_type"], order["amount"])
                _send_email(
                    order["user_email"],
                    "Вы оплатили тариф — осталось зарегистрироваться",
                    body_text,
                )
                mark_reminder_sent(conn, order["inv_id"])
                sent += 1
                print(f"[REMINDER] Отправлено → {order['user_email']} (inv={order['inv_id']})")
            except Exception as e:
                errors.append(f"inv={order['inv_id']} {order['user_email']}: {e}")
                print(f"[REMINDER] Ошибка → {e}")

        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({
                "ok": True,
                "emails_sent": sent,
                "errors": errors,
            }, ensure_ascii=False),
        }
    finally:
        conn.close()
