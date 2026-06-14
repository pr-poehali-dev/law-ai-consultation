-- Добавляем поле для количества консультаций юриста
ALTER TABLE t_p57945357_law_ai_consultation.users
  ADD COLUMN IF NOT EXISTS lawyer_consultations_left INTEGER NOT NULL DEFAULT 0;

-- Старт: 1 консультация (у кого purchased_plan = 'starter' и ещё нет консультаций)
UPDATE t_p57945357_law_ai_consultation.users
SET lawyer_consultations_left = 1
WHERE purchased_plan = 'starter' AND lawyer_consultations_left = 0;

-- Профи: 3 консультации
UPDATE t_p57945357_law_ai_consultation.users
SET lawyer_consultations_left = 3
WHERE purchased_plan = 'pro' AND lawyer_consultations_left = 0;

-- Максимум: 10 консультаций
UPDATE t_p57945357_law_ai_consultation.users
SET lawyer_consultations_left = 10
WHERE purchased_plan = 'max' AND lawyer_consultations_left = 0;

-- Добавляем поле is_consultation_active в lawyer_messages для отслеживания открытой консультации
ALTER TABLE t_p57945357_law_ai_consultation.lawyer_messages
  ADD COLUMN IF NOT EXISTS is_consultation_closed BOOLEAN NOT NULL DEFAULT FALSE;
