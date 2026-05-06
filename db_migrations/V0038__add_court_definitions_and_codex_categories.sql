-- Добавляем новые категории: разъяснения судов и кодексы РФ
-- Расширяем длину поля category и пересоздаём CHECK constraint

ALTER TABLE t_p57945357_law_ai_consultation.legal_docs
    ALTER COLUMN category TYPE VARCHAR(25);

ALTER TABLE t_p57945357_law_ai_consultation.legal_docs
    DROP CONSTRAINT legal_docs_category_check;

ALTER TABLE t_p57945357_law_ai_consultation.legal_docs
    ADD CONSTRAINT legal_docs_category_check
    CHECK (category IN ('case_law', 'state_duty', 'court_definitions', 'codex'));
