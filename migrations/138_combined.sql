CREATE SCHEMA IF NOT EXISTS crm;
CREATE TABLE IF NOT EXISTS crm.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    stage VARCHAR(50) NOT NULL DEFAULT 'prospect',
    amount BIGINT DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'EUR',
    contact_id UUID,
    contact_name VARCHAR(200),
    contact_email VARCHAR(200),
    owner_id UUID NOT NULL,
    tenant_id UUID,
    close_date DATE,
    probability INTEGER DEFAULT 10,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON crm.deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON crm.deals(stage);

CREATE TABLE IF NOT EXISTS crm.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200),
    phone VARCHAR(50),
    company VARCHAR(200),
    source VARCHAR(50),
    status VARCHAR(30) DEFAULT 'new',
    score INTEGER DEFAULT 0,
    owner_id UUID NOT NULL,
    tenant_id UUID,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON crm.leads(owner_id);
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
