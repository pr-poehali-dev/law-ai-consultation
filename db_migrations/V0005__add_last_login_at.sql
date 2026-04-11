-- Дата последнего входа для автоудаления профилей через год
ALTER TABLE t_p57945357_law_ai_consultation.users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();

-- Обновляем существующих пользователей
UPDATE t_p57945357_law_ai_consultation.users SET last_login_at = NOW() WHERE last_login_at IS NULL;
