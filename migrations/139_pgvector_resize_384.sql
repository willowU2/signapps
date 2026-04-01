-- SIG-31: Resize ai.document_vectors.embedding from vector(1536) to vector(384)
--
-- Context: local embedding models (all-MiniLM-L6-v2 / paraphrase-MiniLM-L6-v2)
-- produce 384-dim vectors, not 1536-dim (OpenAI). Migration 059 used 1536 by
-- mistake. Existing embeddings cannot be cast between dimensions — they are
-- truncated (set to empty) so the AI ingestion queue will regenerate them.
--
-- ai.multimodal_vectors already has the correct vector(1024) + HNSW from 061.

-- 1. Drop the stale HNSW index (built on vector(1536), incompatible with 384)
DROP INDEX IF EXISTS ai.idx_document_vectors_embedding;

-- 2. Truncate existing embeddings so the cast succeeds (empty table path).
--    In production this means the ingestion queue will re-embed all documents;
--    the data is never lost — only the vector cache is invalidated.
UPDATE ai.document_vectors SET embedding = NULL;

-- Temporarily allow NULL so we can ALTER the type
ALTER TABLE ai.document_vectors
    ALTER COLUMN embedding DROP NOT NULL;

-- 3. Resize column: NULL values cast cleanly; non-null would require same dim.
ALTER TABLE ai.document_vectors
    ALTER COLUMN embedding TYPE vector(384)
    USING NULL::vector(384);

-- 4. HNSW index — cosine ops, tuned for recall/speed balance
--    m=16  : graph connectivity (higher = better recall, more memory)
--    ef_construction=64 : build-time beam width (higher = better recall, slower build)
CREATE INDEX IF NOT EXISTS idx_document_vectors_embedding
    ON ai.document_vectors
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 5. IVFFlat index as secondary option (cheaper sequential scan at small scale)
--    lists=100 is a reasonable default for up to ~1M rows (sqrt(N) heuristic)
CREATE INDEX IF NOT EXISTS idx_document_vectors_embedding_ivfflat
    ON ai.document_vectors
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 6. Mark existing rows for re-indexing by the AI ingestion pipeline
--    (only if the ingestion_queue table exists from migration 038)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ai' AND table_name = 'ingestion_queue'
    ) THEN
        INSERT INTO ai.ingestion_queue (source_table, record_id, action, status)
        SELECT 'ai.document_vectors', document_id::text, 'UPSERT', 'PENDING'
        FROM (SELECT DISTINCT document_id FROM ai.document_vectors) AS docs
        ON CONFLICT (source_table, record_id) DO UPDATE SET
            status = 'PENDING',
            action = 'UPSERT',
            processed_at = NULL;
    END IF;
END $$;

-- Verification comment (not executed — for DBA reference)
-- SELECT attname, atttypid::regtype FROM pg_attribute
-- WHERE attrelid = 'ai.document_vectors'::regclass AND attname = 'embedding';
-- Expected: vector(384)
