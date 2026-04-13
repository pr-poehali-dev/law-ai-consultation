CREATE TABLE IF NOT EXISTS t_p57945357_law_ai_consultation.orders (
    id SERIAL PRIMARY KEY,
    inv_id INTEGER NOT NULL UNIQUE,
    user_id INTEGER,
    user_email VARCHAR(255) NOT NULL DEFAULT '',
    service_type VARCHAR(50) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_inv_id ON t_p57945357_law_ai_consultation.orders (inv_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON t_p57945357_law_ai_consultation.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON t_p57945357_law_ai_consultation.orders (status);