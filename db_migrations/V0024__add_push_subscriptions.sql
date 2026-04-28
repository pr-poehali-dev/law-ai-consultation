CREATE TABLE IF NOT EXISTS t_p57945357_law_ai_consultation.push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(endpoint)
);