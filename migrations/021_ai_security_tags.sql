-- Add security tags to vector documents for granular access control
ALTER TABLE ai.document_vectors
ADD COLUMN security_tags JSONB DEFAULT '{}'::jsonb;

-- Create an index to quickly filter by security_tags (using GIN for JSONB)
CREATE INDEX IF NOT EXISTS idx_ai_document_vectors_security_tags ON ai.document_vectors USING GIN (security_tags);

-- Create a generic queue for background AI ingestion (Database Crawler / CDC)
CREATE TABLE IF NOT EXISTS ai.ingestion_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table VARCHAR(255) NOT NULL,
    record_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'PENDING' -- 'PENDING', 'PROCESSING', 'FAILED', 'COMPLETED'
);

-- Index for fast polling of pending items by the Scheduler
CREATE INDEX IF NOT EXISTS idx_ai_ingestion_queue_status ON ai.ingestion_queue(status) WHERE status = 'PENDING';
