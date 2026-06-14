-- Восстановление данных пользователя varankina1025@mail.ru (id=312)
-- Тариф "Старт" был оплачен, но auto_credit_on_login не установил paid_expert, purchased_plan, lawyer_consultations_left
-- Также восполняем 3 вопроса, потраченных до зачисления тарифа
UPDATE t_p57945357_law_ai_consultation.users
SET
    paid_questions = 30,
    paid_docs = 5,
    paid_expert = TRUE,
    purchased_plan = 'starter',
    lawyer_consultations_left = 1
WHERE id = 312;