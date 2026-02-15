-- Collections for knowledge base organization
CREATE TABLE ai.collections (
    name VARCHAR(256) PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add collection column to document_vectors (default = backward compatible)
ALTER TABLE ai.document_vectors
    ADD COLUMN collection VARCHAR(256) NOT NULL DEFAULT 'default';

CREATE INDEX idx_document_vectors_collection ON ai.document_vectors(collection);

-- Seed default collection
INSERT INTO ai.collections (name, description) VALUES ('default', 'Collection par defaut');

-- Foreign key: deleting a collection cascades to its vectors
ALTER TABLE ai.document_vectors
    ADD CONSTRAINT fk_document_vectors_collection
    FOREIGN KEY (collection) REFERENCES ai.collections(name) ON DELETE CASCADE;
