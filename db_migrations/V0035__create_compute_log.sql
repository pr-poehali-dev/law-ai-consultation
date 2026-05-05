CREATE TABLE IF NOT EXISTS t_p57945357_law_ai_consultation.compute_log (
    id SERIAL PRIMARY KEY,
    mode VARCHAR(32) NOT NULL,
    duration_ms INTEGER NOT NULL,
    tokens_requested INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compute_log_created_at ON t_p57945357_law_ai_consultation.compute_log (created_at);
