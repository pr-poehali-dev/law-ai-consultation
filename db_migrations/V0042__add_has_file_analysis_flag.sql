ALTER TABLE t_p57945357_law_ai_consultation.users
  ADD COLUMN IF NOT EXISTS has_file_analysis BOOLEAN NOT NULL DEFAULT FALSE;

-- Выставляем TRUE всем кто купил plan_pro или plan_max
UPDATE t_p57945357_law_ai_consultation.users u
SET has_file_analysis = TRUE
WHERE EXISTS (
  SELECT 1 FROM t_p57945357_law_ai_consultation.orders o
  WHERE o.user_id = u.id
    AND o.status = 'paid'
    AND o.service_type IN ('plan_pro', 'plan_max', 'plan_max_expert')
);
