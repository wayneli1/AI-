ALTER TABLE images ADD COLUMN IF NOT EXISTS dify_document_id TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS dify_document_id TEXT;