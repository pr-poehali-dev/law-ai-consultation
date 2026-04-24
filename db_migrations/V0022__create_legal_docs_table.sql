-- Таблица файлов юридической базы знаний (судебная практика и госпошлины)
CREATE TABLE t_p57945357_law_ai_consultation.legal_docs (
    id SERIAL PRIMARY KEY,
    category VARCHAR(20) NOT NULL CHECK (category IN ('case_law', 'state_duty')),
    title VARCHAR(500) NOT NULL,
    filename VARCHAR(500) NOT NULL,
    s3_key VARCHAR(1000) NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    uploaded_by INTEGER NULL REFERENCES t_p57945357_law_ai_consultation.users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT NOT NULL DEFAULT ''
);