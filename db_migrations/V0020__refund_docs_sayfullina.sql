-- Возврат документов Светлане Сайфуллиной (id=110)
-- Оплатила plan_starter (+5 docs) и отдельный document (+1 doc) = 6 документов
-- paid_docs=0 — все использованы/потеряны из-за бага consumeDoc
-- Возвращаем 5 документов как компенсацию (1 мог быть реально использован)
UPDATE t_p57945357_law_ai_consultation.users
SET paid_docs = paid_docs + 5
WHERE id = 110;

INSERT INTO t_p57945357_law_ai_consultation.billing_log
  (user_id, user_email, service_type, amount, description, source)
VALUES
  (110, 'sayfullina_sveta@mail.ru', 'document', 0,
   '+5 докум. · Компенсация: ошибка при генерации документов. Приносим извинения!',
   'admin_grant');