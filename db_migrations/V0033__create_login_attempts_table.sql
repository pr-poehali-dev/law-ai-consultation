CREATE TABLE IF NOT EXISTS t_p57945357_law_ai_consultation.login_attempts (
    id SERIAL PRIMARY KEY,
    ip VARCHAR(64) NOT NULL DEFAULT '',
    email VARCHAR(254) NOT NULL DEFAULT '',
    success BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time
    ON t_p57945357_law_ai_consultation.login_attempts(ip, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
    ON t_p57945357_law_ai_consultation.login_attempts(email, attempted_at);
