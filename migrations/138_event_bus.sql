-- 093_event_bus.sql
-- Event Bus: PostgreSQL outbox pattern with LISTEN/NOTIFY

-- Table: persisted events (outbox)
CREATE TABLE IF NOT EXISTS platform.events (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    source_service VARCHAR(50) NOT NULL,
    aggregate_id UUID,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_type_created ON platform.events (event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_created ON platform.events (created_at);

-- Table: consumer cursor tracking
CREATE TABLE IF NOT EXISTS platform.event_consumers (
    consumer_name VARCHAR(50) PRIMARY KEY,
    last_event_id BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: NOTIFY on new event (sends the BIGSERIAL id as text)
CREATE OR REPLACE FUNCTION platform.notify_event() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('platform_events', NEW.id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_platform_notify_event
    AFTER INSERT ON platform.events
    FOR EACH ROW EXECUTE FUNCTION platform.notify_event();
