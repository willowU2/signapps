-- Migration 209: Partitioned org audit log (RANGE on created_at, monthly)
-- Captures every mutation to org entities with actor info, before/after changes,
-- and structured metadata. 12 monthly partitions + default catch-all.

-- ─── Parent (partitioned) table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workforce_org_audit_log (
    id          UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    actor_id    UUID,
    actor_type  TEXT NOT NULL DEFAULT 'user'
        CHECK (actor_type IN ('user', 'system', 'trigger')),
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   UUID NOT NULL,
    changes     JSONB NOT NULL DEFAULT '{}',
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ─── Monthly partitions (12 months from 2026-04) ──────────────────────────────

CREATE TABLE IF NOT EXISTS workforce_org_audit_log_2026_04
    PARTITION OF workforce_org_audit_log
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS workforce_org_audit_log_2026_05
    PARTITION OF workforce_org_audit_log
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS workforce_org_audit_log_2026_06
    PARTITION OF workforce_org_audit_log
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS workforce_org_audit_log_2026_07
    PARTITION OF workforce_org_audit_log
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS workforce_org_audit_log_2026_08
    PARTITION OF workforce_org_audit_log
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE IF NOT EXISTS workforce_org_audit_log_2026_09
    PARTITION OF workforce_org_audit_log
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS workforce_org_audit_log_2026_10
    PARTITION OF workforce_org_audit_log
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE IF NOT EXISTS workforce_org_audit_log_2026_11
    PARTITION OF workforce_org_audit_log
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE IF NOT EXISTS workforce_org_audit_log_2026_12
    PARTITION OF workforce_org_audit_log
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE TABLE IF NOT EXISTS workforce_org_audit_log_2027_01
    PARTITION OF workforce_org_audit_log
    FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

CREATE TABLE IF NOT EXISTS workforce_org_audit_log_2027_02
    PARTITION OF workforce_org_audit_log
    FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');

CREATE TABLE IF NOT EXISTS workforce_org_audit_log_2027_03
    PARTITION OF workforce_org_audit_log
    FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

-- Default partition catches any rows outside defined ranges
CREATE TABLE IF NOT EXISTS workforce_org_audit_log_default
    PARTITION OF workforce_org_audit_log
    DEFAULT;

-- ─── Indexes (created on the parent, inherited by partitions) ─────────────────

-- Entity lookup (most common: "show history for this entity")
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
    ON workforce_org_audit_log (tenant_id, entity_type, entity_id);

-- Actor lookup ("what did this user do?")
CREATE INDEX IF NOT EXISTS idx_audit_log_actor
    ON workforce_org_audit_log (tenant_id, actor_id);

-- Chronological browsing per tenant
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_time
    ON workforce_org_audit_log (tenant_id, created_at DESC);
