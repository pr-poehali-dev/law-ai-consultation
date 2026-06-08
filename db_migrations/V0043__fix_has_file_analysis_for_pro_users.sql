-- Выставить has_file_analysis для всех пользователей с plan_pro или plan_max (уже оплаченных)
UPDATE t_p57945357_law_ai_consultation.users
SET has_file_analysis = TRUE
WHERE id IN (
    SELECT DISTINCT user_id
    FROM t_p57945357_law_ai_consultation.orders
    WHERE service_type IN ('plan_pro', 'plan_max', 'plan_max_expert', 'doc_analysis')
      AND status = 'paid'
)
AND has_file_analysis = FALSE;