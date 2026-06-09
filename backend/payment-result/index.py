"""
Webhook от ЮКасса (notification URL) после изменения статуса платежа. Live-режим.
ЮКасса шлёт POST с JSON: {type, event, object{id, status, metadata, ...}}.
Проверяем event == 'payment.succeeded', начисляем услугу пользователю.
"""
import json
import os
import smtplib
from email.mime.text import MIMEText
from email.header import Header
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

DESCRIPTIONS = {
    "consultation":          "Консультация живого юриста активирована",
    "document":              "+1 документ",
    "expert":                "Экспертная проверка юристом",
    "business":              "Бизнес-пакет",
    "subscription_consult":  "Подписка: консультации на 31 день",
    "subscription_docs":     "Подписка: документы на 31 день",
    "plan_starter":          "Тариф Старт: +30 вопросов, +5 документов",
    "plan_starter_discount": "Тариф Старт со скидкой 50%: +30 вопросов, +5 документов",
    "plan_pro":              "Тариф Профи: +100 вопросов, +20 документов",
    "plan_max":              "Тариф Максимум: +300 вопросов, +50 документов + консультация юриста",
    "plan_max_expert":       "Тариф Максимум: +300 вопросов, +50 документов + консультация юриста",
    "lawyer_questions":      "+5 вопросов живому юристу",
    "business_subscription": "Бизнес-подписка: +150 действий на 31 день",
    "business_actions_10":   "+10 бизнес-действий",
    "business_actions_30":   "+30 бизнес-действий",
    "business_actions_50":   "+50 бизнес-действий",
    "business_actions_60":   "+60 бизнес-действий",
    "business_actions_150":  "+150 бизнес-действий",
}


SITE_URL = "https://ии-право.рф"

# Что получает пользователь по каждому тарифу
GRANT_DETAILS = {
    "consultation":          "✅ Консультация живого юриста активирована",
    "document":              "✅ +1 документ добавлен на ваш счёт",
    "expert":                "✅ Экспертная проверка юристом активирована",
    "business":              "✅ Бизнес-пакет активирован",
    "subscription_consult":  "✅ Подписка на консультации активирована на 31 день",
    "subscription_docs":     "✅ Подписка на документы активирована на 31 день",
    "plan_starter":          "✅ Тариф «Старт» активирован\n   • +30 вопросов\n   • +5 документов",
    "plan_starter_discount": "✅ Тариф «Старт» активирован\n   • +30 вопросов\n   • +5 документов",
    "plan_pro":              "✅ Тариф «Профи» активирован\n   • +100 вопросов\n   • +20 документов\n   • Анализ файлов",
    "plan_max":              "✅ Тариф «Максимум» активирован\n   • +300 вопросов\n   • +50 документов\n   • Консультация юриста",
    "plan_max_expert":       "✅ Тариф «Максимум» активирован\n   • +300 вопросов\n   • +50 документов\n   • Консультация юриста",
    "business_subscription": "✅ Бизнес-подписка активирована\n   • +150 бизнес-действий\n   • Подписка на 31 день",
    "business_actions_10":   "✅ +10 бизнес-действий добавлено",
    "business_actions_30":   "✅ +30 бизнес-действий добавлено",
    "business_actions_50":   "✅ +50 бизнес-действий добавлено",
    "business_actions_60":   "✅ +60 бизнес-действий добавлено",
    "business_actions_150":  "✅ +150 бизнес-действий добавлено",
}

PLAN_TITLES = {
    "consultation":          "Консультация юриста",
    "document":              "Документ",
    "expert":                "Экспертная проверка",
    "business":              "Бизнес-пакет",
    "subscription_consult":  "Подписка на консультации",
    "subscription_docs":     "Подписка на документы",
    "plan_starter":          "Тариф «Старт»",
    "plan_starter_discount": "Тариф «Старт»",
    "plan_pro":              "Тариф «Профи»",
    "plan_max":              "Тариф «Максимум»",
    "plan_max_expert":       "Тариф «Максимум»",
    "business_subscription": "Бизнес-подписка",
    "business_actions_10":   "+10 бизнес-действий",
    "business_actions_30":   "+30 бизнес-действий",
    "business_actions_50":   "+50 бизнес-действий",
    "business_actions_60":   "+60 бизнес-действий",
    "business_actions_150":  "+150 бизнес-действий",
}


def send_payment_confirmation(to_email: str, user_name: str, service_type: str, amount: float) -> None:
    """Отправляет пользователю письмо об успешной оплате."""
    smtp_from = os.environ.get("SMTP_FROM_EMAIL", "").strip()
    smtp_pass = os.environ.get("SMTP_PASSWORD", "").strip()
    if not smtp_from or not smtp_pass or not to_email:
        return

    plan_title = PLAN_TITLES.get(service_type, service_type)
    grant_text = GRANT_DETAILS.get(service_type, f"✅ {service_type} активирован")
    greeting = f"Здравствуйте, {user_name}!" if user_name else "Здравствуйте!"
    amount_str = f"{amount:,.0f}".replace(",", " ") + " ₽"

    body = (
        f"{greeting}\n\n"
        f"Ваш платёж успешно принят.\n\n"
        f"{'─' * 38}\n"
        f"  Оплачено:  {plan_title}\n"
        f"  Сумма:     {amount_str}\n"
        f"{'─' * 38}\n\n"
        f"{grant_text}\n\n"
        f"Перейдите в личный кабинет, чтобы начать работу:\n"
        f"{SITE_URL}/cabinet\n\n"
        f"Если у вас есть вопросы — напишите нам через кабинет.\n\n"
        f"С уважением,\n"
        f"Команда ИИ-Право.рф"
    )

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = Header(f"Оплата принята — {plan_title} · ИИ-Право.рф", "utf-8")
    msg["From"] = smtp_from
    msg["To"] = to_email

    last_err = None
    try:
        with smtplib.SMTP_SSL("smtp.yandex.ru", 465, timeout=15) as srv:
            srv.login(smtp_from, smtp_pass)
            srv.sendmail(smtp_from, [to_email], msg.as_string())
        print(f"[PAYMENT] Email подтверждения отправлен: {to_email}")
        return
    except Exception as e:
        last_err = f"SSL-465: {e}"
    try:
        with smtplib.SMTP("smtp.yandex.ru", 587, timeout=15) as srv:
            srv.ehlo(); srv.starttls(); srv.ehlo()
            srv.login(smtp_from, smtp_pass)
            srv.sendmail(smtp_from, [to_email], msg.as_string())
        print(f"[PAYMENT] Email подтверждения отправлен (STARTTLS): {to_email}")
        return
    except Exception as e:
        last_err = f"{last_err} | STARTTLS-587: {e}"
    print(f"[PAYMENT] WARN: не удалось отправить email подтверждения: {last_err}")


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def write_billing_log(conn, user_id: int, user_email: str, service_type: str, amount: float, payment_id: str):
    """Записывает событие начисления в billing_log."""
    description = DESCRIPTIONS.get(service_type, service_type)
    cur = conn.cursor()
    try:
        cur.execute(
            f"""INSERT INTO {SCHEMA}.billing_log
                (user_id, user_email, service_type, amount, description, source, payment_id)
                VALUES (%s, %s, %s, %s, %s, 'webhook', %s)""",
            (user_id, user_email, service_type, amount, description, payment_id)
        )
        conn.commit()
    finally:
        cur.close()


def grant_service(conn, user_id: int, service_type: str):
    """Начисляет услугу пользователю по типу."""
    cur = conn.cursor()
    try:
        if service_type == "consultation":
            # Консультация живого юриста — активируем paid_expert + 5 вопросов
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_expert = TRUE, lawyer_questions_left = lawyer_questions_left + 5 WHERE id = %s",
                (user_id,)
            )
        elif service_type == "lawyer_questions":
            # Докупить 5 вопросов к живому юристу
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_expert = TRUE, lawyer_questions_left = lawyer_questions_left + 5 WHERE id = %s",
                (user_id,)
            )
        elif service_type == "document":
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_docs = paid_docs + 1 WHERE id = %s",
                (user_id,)
            )
        elif service_type == "expert":
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET paid_expert = TRUE,
                        paid_questions = CASE
                            WHEN paid_questions = 0 AND (subscription_consult_until IS NULL OR subscription_consult_until < NOW()) THEN 3
                            ELSE paid_questions
                        END
                    WHERE id = %s""",
                (user_id,)
            )
        elif service_type == "business":
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_business = paid_business + 1 WHERE id = %s",
                (user_id,)
            )
        elif service_type == "subscription_consult":
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET subscription_consult_until = GREATEST(NOW(), COALESCE(subscription_consult_until, NOW())) + INTERVAL '31 days'
                    WHERE id = %s""",
                (user_id,)
            )
        elif service_type == "subscription_docs":
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET subscription_docs_until = GREATEST(NOW(), COALESCE(subscription_docs_until, NOW())) + INTERVAL '31 days'
                    WHERE id = %s""",
                (user_id,)
            )
        elif service_type in ("plan_starter", "plan_starter_discount"):
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET paid_questions = paid_questions + 30,
                        paid_docs = paid_docs + 5,
                        paid_expert = TRUE,
                        lawyer_questions_left = lawyer_questions_left + 1,
                        purchased_plan = CASE
                            WHEN purchased_plan IN ('pro', 'max') THEN purchased_plan
                            ELSE 'starter'
                        END
                    WHERE id = %s""",
                (user_id,)
            )
        elif service_type == "plan_pro":
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET paid_questions = paid_questions + 100,
                        paid_docs = paid_docs + 20,
                        paid_expert = TRUE,
                        has_file_analysis = TRUE,
                        lawyer_questions_left = lawyer_questions_left + 5,
                        purchased_plan = CASE
                            WHEN purchased_plan = 'max' THEN purchased_plan
                            ELSE 'pro'
                        END
                    WHERE id = %s""",
                (user_id,)
            )
        elif service_type in ("plan_max", "plan_max_expert"):
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET paid_questions = paid_questions + 300,
                        paid_docs = paid_docs + 50,
                        paid_expert = TRUE,
                        has_file_analysis = TRUE,
                        lawyer_questions_left = lawyer_questions_left + 30,
                        purchased_plan = 'max'
                    WHERE id = %s""",
                (user_id,)
            )
        elif service_type == "business_subscription":
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET business_subscription_until = GREATEST(NOW(), COALESCE(business_subscription_until, NOW())) + INTERVAL '31 days',
                        business_actions_left = business_actions_left + 150
                    WHERE id = %s""",
                (user_id,)
            )
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
        elif service_type == "quick_questions":
            # +3 вопроса к AI-юристу
            cur.execute(
                f"UPDATE {SCHEMA}.users SET paid_questions = paid_questions + 3 WHERE id = %s",
                (user_id,)
            )
        elif service_type == "doc_analysis":
            # Разовый анализ документа
            cur.execute(
                f"UPDATE {SCHEMA}.users SET has_file_analysis = TRUE WHERE id = %s",
                (user_id,)
            )
        conn.commit()
    finally:
        cur.close()


def handler(event: dict, context) -> dict:
    """Webhook ЮКасса — обрабатывает событие payment.succeeded."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    raw_body = event.get("body") or ""
    try:
        notification = json.loads(raw_body)
    except Exception:
        return {"statusCode": 400, "headers": CORS, "body": "Bad JSON"}

    event_type = notification.get("event", "")
    if event_type != "payment.succeeded":
        return {"statusCode": 200, "headers": CORS, "body": "ok"}

    payment_obj = notification.get("object", {})
    payment_id = payment_obj.get("id", "")
    status = payment_obj.get("status", "")
    metadata = payment_obj.get("metadata", {})
    amount_obj = payment_obj.get("amount", {})
    amount_val = float(amount_obj.get("value", 0)) if amount_obj else 0

    if status != "succeeded" or not payment_id:
        return {"statusCode": 200, "headers": CORS, "body": "ok"}

    inv_id_str = metadata.get("inv_id", "")
    service_type = metadata.get("service_type", "")
    user_id_str = metadata.get("user_id", "")

    try:
        inv_id = int(inv_id_str)
    except (ValueError, TypeError):
        return {"statusCode": 400, "headers": CORS, "body": "bad inv_id"}

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT id, user_id, user_email, service_type, amount, status, service_credited FROM {SCHEMA}.orders WHERE inv_id = %s",
            (inv_id,)
        )
        row = cur.fetchone()
        if not row:
            return {"statusCode": 404, "headers": CORS, "body": f"Order not found: {inv_id}"}

        order_id, db_user_id, db_user_email, db_service_type, db_amount, db_status, db_service_credited = row

        if db_status == "paid" and db_service_credited:
            # Уже оплачено И зачислено — идемпотентный ответ
            return {"statusCode": 200, "headers": CORS, "body": "ok"}

        # Помечаем как оплачен, но service_credited пока FALSE — выставим после начисления
        cur.execute(
            f"UPDATE {SCHEMA}.orders SET status = 'paid', paid_at = NOW(), payment_id = %s WHERE id = %s",
            (payment_id, order_id)
        )
        conn.commit()

        effective_user_id = db_user_id
        if not effective_user_id and user_id_str:
            try:
                effective_user_id = int(user_id_str)
            except (ValueError, TypeError):
                pass

        effective_service = db_service_type or service_type
        effective_amount = float(db_amount) if db_amount else amount_val
        effective_email = (db_user_email or "").strip().lower()

        # Fallback: если user_id не привязан, ищем пользователя по email
        if not effective_user_id and effective_email:
            cur2 = conn.cursor()
            try:
                cur2.execute(
                    f"SELECT id FROM {SCHEMA}.users WHERE LOWER(email) = %s",
                    (effective_email,)
                )
                uid_row = cur2.fetchone()
                if uid_row:
                    effective_user_id = uid_row[0]
                    cur2.execute(
                        f"UPDATE {SCHEMA}.orders SET user_id = %s WHERE id = %s",
                        (effective_user_id, order_id)
                    )
                    conn.commit()
                    print(f"[PAYMENT] Привязали user_id={effective_user_id} по email={effective_email}")
            finally:
                cur2.close()

        if effective_user_id and effective_service:
            grant_service(conn, effective_user_id, effective_service)
            write_billing_log(conn, effective_user_id, effective_email, effective_service, effective_amount, payment_id)
            # Помечаем service_credited=TRUE только после успешного начисления
            cur.execute(
                f"UPDATE {SCHEMA}.orders SET service_credited = TRUE WHERE id = %s",
                (order_id,)
            )
            conn.commit()
            print(f"[PAYMENT] Зачислено: user_id={effective_user_id} service={effective_service}")

            # Получаем имя пользователя и отправляем письмо
            if effective_email:
                user_name = ""
                try:
                    cur3 = conn.cursor()
                    cur3.execute(f"SELECT name FROM {SCHEMA}.users WHERE id = %s", (effective_user_id,))
                    name_row = cur3.fetchone()
                    if name_row:
                        user_name = name_row[0] or ""
                    cur3.close()
                except Exception:
                    pass
                send_payment_confirmation(effective_email, user_name, effective_service, effective_amount)
        else:
            # Пользователь ещё не зарегистрирован — НЕ ставим service_credited,
            # чтобы _credit_pending_orders при регистрации мог подхватить ордер
            print(f"[PAYMENT] WARN: пользователь не найден — user_id={effective_user_id}, email={effective_email}, service={effective_service}. Ждём регистрации.")

    finally:
        cur.close()
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": "ok"}