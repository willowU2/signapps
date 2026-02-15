-- Collections for knowledge base organization
CREATE TABLE IF NOT EXISTS ai.collections (
    name VARCHAR(256) PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add collection column to document_vectors (default = backward compatible)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'ai' AND table_name = 'document_vectors' AND column_name = 'collection'
    ) THEN
        ALTER TABLE ai.document_vectors ADD COLUMN collection VARCHAR(256) NOT NULL DEFAULT 'default';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_vectors_collection ON ai.document_vectors(collection);

-- Seed default collection
INSERT INTO ai.collections (name, description) VALUES ('default', 'Collection par defaut')
    ON CONFLICT (name) DO NOTHING;

-- Foreign key: deleting a collection cascades to its vectors
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_document_vectors_collection'
    ) THEN
        ALTER TABLE ai.document_vectors
            ADD CONSTRAINT fk_document_vectors_collection
            FOREIGN KEY (collection) REFERENCES ai.collections(name) ON DELETE CASCADE;
    END IF;
END $$;
