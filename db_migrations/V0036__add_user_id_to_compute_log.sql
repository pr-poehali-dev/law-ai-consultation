ALTER TABLE t_p57945357_law_ai_consultation.compute_log
  ADD COLUMN IF NOT EXISTS user_id INTEGER,
  ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_compute_log_user_id ON t_p57945357_law_ai_consultation.compute_log (user_id);
CREATE INDEX IF NOT EXISTS idx_compute_log_created_user ON t_p57945357_law_ai_consultation.compute_log (created_at, user_id);
