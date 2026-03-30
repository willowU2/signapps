-- 093_event_bus.sql
-- Event Bus: PostgreSQL outbox pattern with LISTEN/NOTIFY

-- Table: persisted events (outbox)
CREATE TABLE IF NOT EXISTS platform.events (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    event_type VARCHAR(100) NOT NULL,
    source_service VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    tenant_id UUID,
    actor_id UUID,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_type_created ON platform.events (event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_entity ON platform.events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON platform.events (created_at);

-- Table: consumer cursor tracking
CREATE TABLE IF NOT EXISTS platform.event_consumers (
    consumer VARCHAR(50) PRIMARY KEY,
    last_event_id UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: NOTIFY on new event
CREATE OR REPLACE FUNCTION platform.notify_event() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('platform_events', json_build_object(
        'id', NEW.id,
        'event_type', NEW.event_type,
        'source_service', NEW.source_service,
        'entity_type', NEW.entity_type,
        'entity_id', NEW.entity_id,
        'tenant_id', NEW.tenant_id
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_platform_notify_event
    AFTER INSERT ON platform.events
    FOR EACH ROW EXECUTE FUNCTION platform.notify_event();
