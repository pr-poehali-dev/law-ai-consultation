-- Зачисляем 1 документ пользователю gordeikina2003@gmail.com (id=143)
-- по ордеру id=205, который был оплачен но не зачислен из-за порядка регистрации
UPDATE t_p57945357_law_ai_consultation.users
SET paid_docs = paid_docs + 1
WHERE id = 143;

-- Привязываем user_id в ордере
UPDATE t_p57945357_law_ai_consultation.orders
SET user_id = 143
WHERE id = 205;

-- Добавляем запись в billing_log
INSERT INTO t_p57945357_law_ai_consultation.billing_log
  (user_id, user_email, service_type, amount, description, source, payment_id)
VALUES
  (143, 'gordeikina2003@gmail.com', 'document', 600.00, '+1 документ (ручное зачисление, webhook до регистрации)', 'manual', '3184fd4b-000f-5000-b000-113f62717441');
