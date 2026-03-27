-- Migration 073: metrics.experiments + metrics.esg_scores + metrics.esg_quarterly

-- Ensure schema exists (metrics service may create it separately)
CREATE SCHEMA IF NOT EXISTS metrics;

-- ---------------------------------------------------------------------------
-- metrics.experiments — A/B Testing
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metrics.experiments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    description   TEXT,
    status        TEXT NOT NULL DEFAULT 'draft', -- draft | running | paused | completed
    variants      JSONB NOT NULL DEFAULT '[]',
    traffic_split JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiments_status     ON metrics.experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_created_at ON metrics.experiments(created_at DESC);

-- ---------------------------------------------------------------------------
-- metrics.esg_scores — ESG scores per tenant/category
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metrics.esg_scores (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    category   TEXT NOT NULL,    -- e.g. 'environmental', 'social', 'governance'
    score      DOUBLE PRECISION NOT NULL DEFAULT 0,
    trend      TEXT,             -- e.g. 'up', 'down', 'stable'
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, category)
);

CREATE INDEX IF NOT EXISTS idx_esg_scores_tenant_id ON metrics.esg_scores(tenant_id);

-- ---------------------------------------------------------------------------
-- metrics.esg_quarterly — ESG quarterly scores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metrics.esg_quarterly (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    quarter    INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
    year       INTEGER NOT NULL,
    score      DOUBLE PRECISION NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, quarter, year)
);

CREATE INDEX IF NOT EXISTS idx_esg_quarterly_tenant_id ON metrics.esg_quarterly(tenant_id);
