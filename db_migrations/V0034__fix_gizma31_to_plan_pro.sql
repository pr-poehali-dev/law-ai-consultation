-- Устанавливаем Екатерине paid_questions = 100 для доступа к загрузке файлов (Тариф Профи)
UPDATE t_p57945357_law_ai_consultation.users
SET paid_questions = 100, paid_docs = 20
WHERE id = 170 AND email = 'gizma31@mail.ru';

INSERT INTO t_p57945357_law_ai_consultation.billing_log
  (user_id, user_email, service_type, amount, description, source)
VALUES
  (170, 'gizma31@mail.ru', 'plan_pro', 0, 'Исправление: установлено 100 вопр / 20 докум (Тариф Профи, перезапись set_questions)', 'manual_fix');
