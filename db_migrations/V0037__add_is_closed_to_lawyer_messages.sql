-- Добавляем поле is_closed для закрытия диалогов юристом
ALTER TABLE lawyer_messages ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;

-- Добавляем тип вложения file для загружаемых пользователем файлов
-- (attachment_type уже есть, просто расширяем допустимые значения логически)

-- Индекс для быстрой выборки открытых диалогов
CREATE INDEX IF NOT EXISTS idx_lawyer_messages_is_closed ON lawyer_messages(is_closed);
