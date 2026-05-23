ALTER TABLE t_p57945357_law_ai_consultation.users
  ADD COLUMN IF NOT EXISTS lawyer_questions_left INTEGER NOT NULL DEFAULT 0;
