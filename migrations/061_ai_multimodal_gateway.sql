-- AI Multimodal Gateway: vectors, conversations, generated media, model registry
-- Depends on: 007 (ai schema), 008 (ai.collections), 059 (pgvector extension)

--------------------------------------------------------------------------------
-- 1. ai.multimodal_vectors — SigLIP 1024-dim embeddings for images/audio/video
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai.multimodal_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    media_type VARCHAR(32) NOT NULL,           -- 'image', 'audio', 'video_frame', 'text'
    content TEXT,                               -- text description or transcript
    filename VARCHAR(512) NOT NULL,
    path TEXT NOT NULL,
    mime_type VARCHAR(128),
    collection VARCHAR(256) NOT NULL DEFAULT 'default'
        REFERENCES ai.collections(name) ON DELETE CASCADE,
    embedding TEXT,                    -- SigLIP embeddings (bypassed vector(1024))
    metadata JSONB DEFAULT '{}'::jsonb,
    security_tags JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, chunk_index, media_type)
);

-- CREATE INDEX IF NOT EXISTS idx_multimodal_vectors_embedding
--     ON ai.multimodal_vectors
--     USING hnsw (embedding vector_cosine_ops)
--     WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_multimodal_vectors_collection
    ON ai.multimodal_vectors(collection);

CREATE INDEX IF NOT EXISTS idx_multimodal_vectors_media_type
    ON ai.multimodal_vectors(media_type);

CREATE INDEX IF NOT EXISTS idx_multimodal_vectors_metadata
    ON ai.multimodal_vectors
    USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_multimodal_vectors_document_id
    ON ai.multimodal_vectors(document_id);

--------------------------------------------------------------------------------
-- 2. ai.conversations — chat history per user
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(512),
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
    ON ai.conversations(user_id, updated_at DESC);

--------------------------------------------------------------------------------
-- 3. ai.conversation_messages — individual messages within a conversation
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai.conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL
        REFERENCES ai.conversations(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,
    media JSONB DEFAULT '[]'::jsonb,
    model VARCHAR(256),
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conv_created
    ON ai.conversation_messages(conversation_id, created_at);

--------------------------------------------------------------------------------
-- 4. ai.generated_media — images/audio/video produced by AI models
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai.generated_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_type VARCHAR(32) NOT NULL,
    prompt TEXT NOT NULL,
    model_used VARCHAR(256) NOT NULL,
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    metadata JSONB DEFAULT '{}'::jsonb,
    indexed BOOLEAN DEFAULT false,
    conversation_id UUID
        REFERENCES ai.conversations(id) ON DELETE SET NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_media_user_created
    ON ai.generated_media(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_media_not_indexed
    ON ai.generated_media(id)
    WHERE indexed = false;

--------------------------------------------------------------------------------
-- 5. ai.model_registry — available / downloaded models
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai.model_registry (
    id VARCHAR(256) PRIMARY KEY,
    model_type VARCHAR(64) NOT NULL,
    source VARCHAR(512) NOT NULL,
    local_path TEXT,
    size_bytes BIGINT,
    status VARCHAR(32) NOT NULL DEFAULT 'available',
    recommended_vram_mb INTEGER,
    hardware_tier VARCHAR(32),
    downloaded_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);
