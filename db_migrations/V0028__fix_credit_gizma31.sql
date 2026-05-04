-- Начисляем plan_starter (30 вопросов + 5 документов) Екатерине gizma31@mail.ru (id=170)
UPDATE t_p57945357_law_ai_consultation.users
SET paid_questions = paid_questions + 30,
    paid_docs = paid_docs + 5
WHERE id = 170;

-- Привязываем её ордер к user_id
UPDATE t_p57945357_law_ai_consultation.orders
SET user_id = 170
WHERE inv_id = 231 AND LOWER(user_email) = 'gizma31@mail.ru';

-- Записываем в billing_log
INSERT INTO t_p57945357_law_ai_consultation.billing_log
  (user_id, user_email, service_type, amount, description, source)
VALUES
  (170, 'gizma31@mail.ru', 'plan_starter', 990.00, 'Тариф Старт: +30 вопросов, +5 документов (ручное начисление)', 'manual_fix');
