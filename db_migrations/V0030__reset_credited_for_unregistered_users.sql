-- Сбрасываем service_credited для ордеров где user_id=NULL (пользователь не зарегистрировался)
-- Это позволит _credit_pending_orders при регистрации подхватить эти ордера
UPDATE t_p57945357_law_ai_consultation.orders
SET service_credited = FALSE
WHERE status = 'paid'
  AND user_id IS NULL
  AND service_credited = TRUE;
