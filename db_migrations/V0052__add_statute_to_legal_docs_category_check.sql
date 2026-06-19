ALTER TABLE t_p57945357_law_ai_consultation.legal_docs
  DROP CONSTRAINT legal_docs_category_check;

ALTER TABLE t_p57945357_law_ai_consultation.legal_docs
  ADD CONSTRAINT legal_docs_category_check
  CHECK (category IN ('case_law', 'state_duty', 'court_definitions', 'codex', 'statute'));