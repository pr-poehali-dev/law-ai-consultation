ALTER TABLE t_p57945357_law_ai_consultation.users
  ADD COLUMN IF NOT EXISTS phone_norm VARCHAR(20) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_users_phone_norm
  ON t_p57945357_law_ai_consultation.users (phone_norm)
  WHERE phone_norm != '';