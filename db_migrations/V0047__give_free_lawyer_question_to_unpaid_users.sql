-- Дать 1 бесплатный вопрос юристу всем существующим пользователям без тарифа
UPDATE t_p57945357_law_ai_consultation.users
SET lawyer_questions_left = 1
WHERE purchased_plan IS NULL
  AND NOT paid_expert
  AND NOT is_admin
  AND lawyer_questions_left = 0;

-- Изменить дефолт для новых пользователей
ALTER TABLE t_p57945357_law_ai_consultation.users
  ALTER COLUMN lawyer_questions_left SET DEFAULT 1;
