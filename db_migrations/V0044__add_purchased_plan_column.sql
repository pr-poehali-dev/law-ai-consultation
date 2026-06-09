-- Добавляем purchased_plan: фиксирует минимальный купленный уровень тарифа
-- Значения: NULL (не покупал), 'starter', 'pro', 'max'
-- Не уменьшается при трате вопросов/документов
ALTER TABLE t_p57945357_law_ai_consultation.users
  ADD COLUMN IF NOT EXISTS purchased_plan VARCHAR(20) DEFAULT NULL;

-- Заполняем ретроспективно для существующих пользователей
UPDATE t_p57945357_law_ai_consultation.users
SET purchased_plan = CASE
  WHEN paid_questions >= 300 OR paid_docs >= 50 THEN 'max'
  WHEN paid_questions >= 100 OR paid_docs >= 20 THEN 'pro'
  WHEN paid_questions >= 30  OR paid_docs >= 5
    OR paid_questions > 0    OR paid_docs > 0    THEN 'starter'
  ELSE NULL
END
WHERE purchased_plan IS NULL
  AND (paid_questions > 0 OR paid_docs > 0 OR paid_expert = TRUE);