ALTER TABLE t_p57945357_law_ai_consultation.users
  ADD COLUMN IF NOT EXISTS business_subscription_until TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS business_actions_left INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS business_org_name VARCHAR(255) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS t_p57945357_law_ai_consultation.business_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p57945357_law_ai_consultation.users(id),
  role VARCHAR(10) NOT NULL CHECK (role IN ('user','ai')),
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_messages_user ON t_p57945357_law_ai_consultation.business_messages(user_id, created_at DESC);
