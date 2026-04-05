-- Migration 216: LightRAG Knowledge Graph
-- Entities, relations, and communities for graph-based RAG.

-- Enable trigram for fuzzy entity name search (may already exist)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Entities ──
CREATE TABLE ai.kg_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection VARCHAR(256) NOT NULL REFERENCES ai.collections(name) ON DELETE CASCADE,
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL,              -- person, organization, concept, technology, location, event, etc.
    description TEXT,                       -- LLM-generated description
    source_document_ids UUID[] DEFAULT '{}', -- Which documents mention this entity
    attributes JSONB DEFAULT '{}',         -- Additional structured attributes
    embedding vector(384),                 -- Embedding of name + description
    mention_count INT DEFAULT 1,           -- How many times referenced
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(collection, name, entity_type)
);

CREATE INDEX idx_kg_entities_collection ON ai.kg_entities(collection);
CREATE INDEX idx_kg_entities_type ON ai.kg_entities(entity_type);
CREATE INDEX idx_kg_entities_name ON ai.kg_entities USING gin(name gin_trgm_ops);
CREATE INDEX idx_kg_entities_embedding ON ai.kg_entities USING hnsw(embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ── Relations ──
CREATE TABLE ai.kg_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection VARCHAR(256) NOT NULL REFERENCES ai.collections(name) ON DELETE CASCADE,
    source_entity_id UUID NOT NULL REFERENCES ai.kg_entities(id) ON DELETE CASCADE,
    target_entity_id UUID NOT NULL REFERENCES ai.kg_entities(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL,            -- works_at, depends_on, implements, etc.
    description TEXT,                       -- LLM-generated description of the relation
    weight REAL DEFAULT 1.0,               -- Relation strength
    source_document_ids UUID[] DEFAULT '{}',
    attributes JSONB DEFAULT '{}',
    embedding vector(384),                 -- Embedding of source + relation + target description
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(collection, source_entity_id, target_entity_id, relation_type)
);

CREATE INDEX idx_kg_relations_collection ON ai.kg_relations(collection);
CREATE INDEX idx_kg_relations_source ON ai.kg_relations(source_entity_id);
CREATE INDEX idx_kg_relations_target ON ai.kg_relations(target_entity_id);
CREATE INDEX idx_kg_relations_type ON ai.kg_relations(relation_type);
CREATE INDEX idx_kg_relations_embedding ON ai.kg_relations USING hnsw(embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ── Communities (clusters of related entities) ──
CREATE TABLE ai.kg_communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection VARCHAR(256) NOT NULL REFERENCES ai.collections(name) ON DELETE CASCADE,
    level INT NOT NULL DEFAULT 0,          -- Hierarchy level (0=finest, higher=coarser)
    title TEXT,                            -- LLM-generated community title
    summary TEXT,                          -- LLM-generated community summary
    entity_ids UUID[] DEFAULT '{}',        -- Entities in this community
    embedding vector(384),                 -- Embedding of the summary
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kg_communities_collection ON ai.kg_communities(collection);
CREATE INDEX idx_kg_communities_level ON ai.kg_communities(level);
CREATE INDEX idx_kg_communities_embedding ON ai.kg_communities USING hnsw(embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
