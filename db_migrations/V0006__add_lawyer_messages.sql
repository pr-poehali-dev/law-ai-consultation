CREATE TABLE IF NOT EXISTS t_p57945357_law_ai_consultation.lawyer_messages (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'admin')),
    body TEXT NOT NULL,
    attachment_type VARCHAR(20),
    attachment_name TEXT,
    attachment_content TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lawyer_messages_user_id ON t_p57945357_law_ai_consultation.lawyer_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_messages_created_at ON t_p57945357_law_ai_consultation.lawyer_messages(created_at DESC);
