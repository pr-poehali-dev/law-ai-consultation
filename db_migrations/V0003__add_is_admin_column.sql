ALTER TABLE t_p57945357_law_ai_consultation.users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE t_p57945357_law_ai_consultation.users
  SET is_admin = TRUE
  WHERE email = 'ilya.povarchuk@mail.ru';
