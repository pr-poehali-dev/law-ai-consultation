-- GIN индекс на tsvector — ускоряет полнотекстовый поиск в 10-50x
CREATE INDEX IF NOT EXISTS idx_legal_doc_chunks_tsv
    ON t_p57945357_law_ai_consultation.legal_doc_chunks
    USING gin(content_tsv);

-- Составной индекс для фильтрации по категории + активности
CREATE INDEX IF NOT EXISTS idx_legal_docs_category_active
    ON t_p57945357_law_ai_consultation.legal_docs(category, is_active);

-- Индекс для быстрого поиска чанков по документу
CREATE INDEX IF NOT EXISTS idx_legal_doc_chunks_doc_id
    ON t_p57945357_law_ai_consultation.legal_doc_chunks(doc_id, chunk_index);

-- Индекс для пустых чанков (фильтр c.content != '')
CREATE INDEX IF NOT EXISTS idx_legal_doc_chunks_nonempty
    ON t_p57945357_law_ai_consultation.legal_doc_chunks(doc_id)
    WHERE content != '';