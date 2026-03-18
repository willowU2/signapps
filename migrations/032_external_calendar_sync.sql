-- External Calendar Sync Schema
-- Manages OAuth connections to Google, Microsoft, Apple, CalDAV providers

-- Provider connection stores OAuth tokens and connection state
CREATE TABLE IF NOT EXISTS calendar.provider_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'microsoft', 'apple', 'caldav')),

    -- OAuth tokens (encrypted in application layer)
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,

    -- Account info
    account_email VARCHAR(255),
    account_name VARCHAR(255),

    -- Connection state
    is_connected BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    sync_status VARCHAR(20) NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error', 'paused')),
    sync_error TEXT,

    -- CalDAV specific
    caldav_url TEXT,
    caldav_username VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, provider)
);

-- External calendars discovered from providers
CREATE TABLE IF NOT EXISTS calendar.external_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES calendar.provider_connections(id) ON DELETE CASCADE,

    -- External ID from provider
    external_id VARCHAR(500) NOT NULL,

    -- Calendar metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20),
    timezone VARCHAR(50),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_readonly BOOLEAN NOT NULL DEFAULT false,

    -- Sync state
    sync_enabled BOOLEAN NOT NULL DEFAULT false,
    last_sync_at TIMESTAMPTZ,
    sync_token TEXT,  -- For incremental sync

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(connection_id, external_id)
);

-- Sync configuration between local and external calendars
CREATE TABLE IF NOT EXISTS calendar.sync_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,

    -- Local calendar (our system)
    local_calendar_id UUID NOT NULL REFERENCES calendar.calendars(id) ON DELETE CASCADE,

    -- External calendar
    external_calendar_id UUID NOT NULL REFERENCES calendar.external_calendars(id) ON DELETE CASCADE,

    -- Sync settings
    sync_direction VARCHAR(20) NOT NULL DEFAULT 'bidirectional' CHECK (sync_direction IN ('import_only', 'export_only', 'bidirectional')),
    conflict_resolution VARCHAR(20) NOT NULL DEFAULT 'newest' CHECK (conflict_resolution IN ('local_wins', 'remote_wins', 'newest', 'ask')),

    -- What to sync
    sync_events BOOLEAN NOT NULL DEFAULT true,
    sync_reminders BOOLEAN NOT NULL DEFAULT true,
    sync_attendees BOOLEAN NOT NULL DEFAULT true,

    -- Filter options
    sync_past_events BOOLEAN NOT NULL DEFAULT false,
    past_events_days INTEGER DEFAULT 30,

    -- Auto-sync settings
    auto_sync_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
    last_auto_sync_at TIMESTAMPTZ,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(local_calendar_id, external_calendar_id)
);

-- Sync log for tracking synchronization history
CREATE TABLE IF NOT EXISTS calendar.sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_config_id UUID NOT NULL REFERENCES calendar.sync_configs(id) ON DELETE CASCADE,

    -- Sync details
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('import', 'export', 'both')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'partial', 'failed')),

    -- Statistics
    events_imported INTEGER NOT NULL DEFAULT 0,
    events_exported INTEGER NOT NULL DEFAULT 0,
    events_updated INTEGER NOT NULL DEFAULT 0,
    events_deleted INTEGER NOT NULL DEFAULT 0,
    conflicts_detected INTEGER NOT NULL DEFAULT 0,

    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Error info
    error_message TEXT,
    error_details JSONB
);

-- Sync conflicts that need user resolution
CREATE TABLE IF NOT EXISTS calendar.sync_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_config_id UUID NOT NULL REFERENCES calendar.sync_configs(id) ON DELETE CASCADE,

    -- Event identifiers
    local_event_id UUID REFERENCES calendar.events(id) ON DELETE SET NULL,
    external_event_id VARCHAR(500),

    -- Conflict details
    conflict_type VARCHAR(20) NOT NULL CHECK (conflict_type IN ('update', 'delete', 'create')),
    local_data JSONB,
    remote_data JSONB,
    local_updated_at TIMESTAMPTZ,
    external_updated_at TIMESTAMPTZ,

    -- Resolution
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolution VARCHAR(20) CHECK (resolution IN ('local', 'remote', 'merged', 'skipped')),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES identity.users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event mapping between local and external events
CREATE TABLE IF NOT EXISTS calendar.event_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_config_id UUID NOT NULL REFERENCES calendar.sync_configs(id) ON DELETE CASCADE,

    -- IDs
    local_event_id UUID NOT NULL REFERENCES calendar.events(id) ON DELETE CASCADE,
    external_event_id VARCHAR(500) NOT NULL,

    -- Sync state
    local_etag VARCHAR(100),
    external_etag VARCHAR(100),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Checksums for change detection
    local_checksum VARCHAR(64),
    external_checksum VARCHAR(64),

    UNIQUE(sync_config_id, local_event_id),
    UNIQUE(sync_config_id, external_event_id)
);

-- OAuth state for CSRF protection
CREATE TABLE IF NOT EXISTS calendar.oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    state VARCHAR(100) NOT NULL UNIQUE,
    provider VARCHAR(20) NOT NULL,
    redirect_uri TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_provider_connections_user ON calendar.provider_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_connections_provider ON calendar.provider_connections(provider);
CREATE INDEX IF NOT EXISTS idx_external_calendars_connection ON calendar.external_calendars(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_configs_user ON calendar.sync_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_configs_local ON calendar.sync_configs(local_calendar_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_config ON calendar.sync_logs(sync_config_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON calendar.sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_config ON calendar.sync_conflicts(sync_config_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_unresolved ON calendar.sync_conflicts(sync_config_id) WHERE NOT resolved;
CREATE INDEX IF NOT EXISTS idx_event_mappings_local ON calendar.event_mappings(local_event_id);
CREATE INDEX IF NOT EXISTS idx_event_mappings_external ON calendar.event_mappings(external_event_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON calendar.oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON calendar.oauth_states(expires_at);

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION calendar.update_provider_connection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_provider_connections_updated
    BEFORE UPDATE ON calendar.provider_connections
    FOR EACH ROW
    EXECUTE FUNCTION calendar.update_provider_connection_timestamp();

CREATE TRIGGER trg_external_calendars_updated
    BEFORE UPDATE ON calendar.external_calendars
    FOR EACH ROW
    EXECUTE FUNCTION calendar.update_provider_connection_timestamp();

CREATE TRIGGER trg_sync_configs_updated
    BEFORE UPDATE ON calendar.sync_configs
    FOR EACH ROW
    EXECUTE FUNCTION calendar.update_provider_connection_timestamp();

-- Cleanup job for expired OAuth states (should be run periodically)
-- DELETE FROM calendar.oauth_states WHERE expires_at < NOW();
