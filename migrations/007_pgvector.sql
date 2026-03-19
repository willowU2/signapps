-- Bypassed pgvector extension installation to prevent failures silently
-- CREATE EXTENSION IF NOT EXISTS vector;
-- Create AI schema if not exists
CREATE SCHEMA IF NOT EXISTS ai;
-- Table for document vector embeddings
CREATE TABLE IF NOT EXISTS ai.document_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    filename VARCHAR(512) NOT NULL,
    path TEXT NOT NULL DEFAULT '',
    mime_type VARCHAR(128),
    embedding TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, chunk_index)
);
-- HNSW index bypassed since column is TEXT
-- CREATE INDEX IF NOT EXISTS idx_document_vectors_embedding ON ai.document_vectors USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-- Index for lookup by document
CREATE INDEX IF NOT EXISTS idx_document_vectors_document_id ON ai.document_vectors(document_id);