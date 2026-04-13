CREATE TABLE IF NOT EXISTS t_p57945357_law_ai_consultation.billing_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_email VARCHAR(255) NOT NULL DEFAULT '',
    service_type VARCHAR(50) NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    source VARCHAR(20) NOT NULL DEFAULT 'webhook',
    payment_id VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_log_user_id ON t_p57945357_law_ai_consultation.billing_log (user_id);
CREATE INDEX IF NOT EXISTS idx_billing_log_created_at ON t_p57945357_law_ai_consultation.billing_log (created_at DESC);
