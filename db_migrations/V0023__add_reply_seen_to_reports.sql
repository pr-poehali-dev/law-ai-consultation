-- Добавляем флаг "ответ прочитан пользователем" в таблицу reports
ALTER TABLE t_p57945357_law_ai_consultation.reports 
ADD COLUMN IF NOT EXISTS reply_seen BOOLEAN NOT NULL DEFAULT FALSE;