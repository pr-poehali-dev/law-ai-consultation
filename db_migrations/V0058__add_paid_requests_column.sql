ALTER TABLE t_p57945357_law_ai_consultation.users
    ADD COLUMN paid_requests INTEGER NOT NULL DEFAULT 0;

UPDATE t_p57945357_law_ai_consultation.users
    SET paid_requests = COALESCE(paid_questions, 0) + COALESCE(paid_docs, 0);
