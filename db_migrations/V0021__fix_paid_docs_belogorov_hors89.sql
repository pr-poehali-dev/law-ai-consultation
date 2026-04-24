-- Зачисляем paid_docs пользователям с проблемной оплатой
-- yaramirbelogorov@yandex.ru (id=129): ордер 187 оплачен, service_credited=true, но user_id был null — не зачислено
-- hors89@yandex.ru (id=130): ордер 191 оплачен с email='Hors89@yandex.ru' (другой регистр), user_id=null — не зачислено
UPDATE t_p57945357_law_ai_consultation.users 
SET paid_docs = paid_docs + 1 
WHERE id IN (129, 130);

-- Фиксируем привязку ордеров к user_id для корректности статистики
UPDATE t_p57945357_law_ai_consultation.orders 
SET user_id = 130 
WHERE id = 191 AND user_id IS NULL;

UPDATE t_p57945357_law_ai_consultation.orders 
SET user_id = 129 
WHERE id = 187 AND user_id IS NULL;