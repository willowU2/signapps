-- AQ-SECEVT: Create security_events table for security event alerting
CREATE TABLE IF NOT EXISTS platform.security_events (
    id          UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    event_type  TEXT NOT NULL,
    severity    TEXT NOT NULL DEFAULT 'info',
    actor_id    UUID,
    ip_address  TEXT,
    resource    TEXT,
    details     TEXT NOT NULL,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON platform.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON platform.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_actor ON platform.security_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON platform.security_events(created_at DESC);
