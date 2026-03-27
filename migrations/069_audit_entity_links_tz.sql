-- Migration 069: audit_logs, entity_links, calendar.user_settings
-- SYNC-AUDIT-ROUTES, SYNC-CROSSLINKS, SYNC-CALENDAR-TZ

-- ---------------------------------------------------------------------------
-- identity.audit_logs (SYNC-AUDIT-ROUTES)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identity.audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    username      TEXT,
    action        TEXT NOT NULL,
    resource_type TEXT,
    resource_id   TEXT,
    ip_address    TEXT,
    user_agent    TEXT,
    details       JSONB DEFAULT '{}',
    status        TEXT DEFAULT 'success',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON identity.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action       ON identity.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at   ON identity.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource     ON identity.audit_logs(resource_type, resource_id);

-- ---------------------------------------------------------------------------
-- identity.entity_links (SYNC-CROSSLINKS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identity.entity_links (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type  TEXT NOT NULL,
    source_id    UUID NOT NULL,
    target_type  TEXT NOT NULL,
    target_id    UUID NOT NULL,
    relation     TEXT,
    created_by   UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_type, source_id, target_type, target_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_entity_links_source ON identity.entity_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_target ON identity.entity_links(target_type, target_id);

-- ---------------------------------------------------------------------------
-- calendar.user_settings (SYNC-CALENDAR-TZ)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar.user_settings (
    user_id    UUID PRIMARY KEY,
    timezone   TEXT NOT NULL DEFAULT 'UTC',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
