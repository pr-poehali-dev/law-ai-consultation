CREATE TABLE IF NOT EXISTS t_p57945357_law_ai_consultation.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL DEFAULT '',
    password_hash VARCHAR(255) NOT NULL DEFAULT '',
    free_questions_used INTEGER NOT NULL DEFAULT 0,
    paid_questions INTEGER NOT NULL DEFAULT 0,
    paid_docs INTEGER NOT NULL DEFAULT 0,
    paid_expert BOOLEAN NOT NULL DEFAULT FALSE,
    paid_business INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p57945357_law_ai_consultation.sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_p57945357_law_ai_consultation.users(id),
    token VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '30 days'
);

CREATE TABLE IF NOT EXISTS t_p57945357_law_ai_consultation.otp_codes (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
    used BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON t_p57945357_law_ai_consultation.sessions(token);
CREATE INDEX IF NOT EXISTS idx_otp_email ON t_p57945357_law_ai_consultation.otp_codes(email);
