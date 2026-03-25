-- Add 'dm' to allowed document types for Direct Messages
ALTER TABLE documents DROP CONSTRAINT documents_doc_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_doc_type_check 
    CHECK (doc_type IN ('text', 'sheet', 'slide', 'board', 'chat', 'dm'));
