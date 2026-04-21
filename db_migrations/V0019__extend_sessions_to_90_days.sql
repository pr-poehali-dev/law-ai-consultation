-- Продлеваем дефолт сессий до 90 дней
ALTER TABLE t_p57945357_law_ai_consultation.sessions
  ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '90 days');

-- Продлеваем все ещё живые сессии до 90 дней от создания
UPDATE t_p57945357_law_ai_consultation.sessions
  SET expires_at = created_at + INTERVAL '90 days'
  WHERE expires_at > NOW();
