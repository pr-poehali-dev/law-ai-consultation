ALTER TABLE t_p57945357_law_ai_consultation.legal_docs
  ADD COLUMN IF NOT EXISTS doc_year SMALLINT NULL,
  ADD COLUMN IF NOT EXISTS subcategory VARCHAR(50) NOT NULL DEFAULT '';

COMMENT ON COLUMN t_p57945357_law_ai_consultation.legal_docs.doc_year IS '2024, 2025, 2026, 2027 — год практики';
COMMENT ON COLUMN t_p57945357_law_ai_consultation.legal_docs.subcategory IS 'civil, criminal, administrative — подкатегория судебной практики';