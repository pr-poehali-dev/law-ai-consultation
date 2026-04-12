CREATE TABLE t_p57945357_law_ai_consultation.reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_name VARCHAR(255),
    user_email VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    admin_reply TEXT,
    replied_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reports_user_id ON t_p57945357_law_ai_consultation.reports(user_id);
CREATE INDEX idx_reports_status ON t_p57945357_law_ai_consultation.reports(status);
