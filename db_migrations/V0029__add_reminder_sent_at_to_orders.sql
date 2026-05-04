ALTER TABLE t_p57945357_law_ai_consultation.orders
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_reminder_needed
ON t_p57945357_law_ai_consultation.orders(created_at, status, service_credited, reminder_sent_at)
WHERE status = 'paid' AND service_credited = FALSE;
