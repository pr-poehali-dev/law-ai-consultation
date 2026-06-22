ALTER TABLE t_p57945357_law_ai_consultation.lawyer_messages
ADD COLUMN IF NOT EXISTS edited_content text NULL,
ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone NULL;