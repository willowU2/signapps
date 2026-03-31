-- 133: Custom monitors — user-defined health checks with scheduling and alerting

CREATE TABLE IF NOT EXISTS it.custom_monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('http_check','port_check','service_check','file_check','process_check')),
    -- http_check
    url TEXT,
    expected_status_code INTEGER,
    response_contains TEXT,
    -- port_check
    host VARCHAR(255),
    port INTEGER,
    -- service_check
    service_name VARCHAR(200),
    -- file_check
    file_path TEXT,
    -- process_check
    process_name VARCHAR(200),
    -- scheduling
    interval_minutes INTEGER NOT NULL DEFAULT 5 CHECK (interval_minutes IN (1,5,15,60)),
    -- state
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_checked_at TIMESTAMPTZ,
    last_status VARCHAR(20), -- 'ok' | 'fail' | 'unknown'
    last_error TEXT,
    consecutive_failures INTEGER DEFAULT 0,
    -- alerting
    alert_on_failure BOOLEAN NOT NULL DEFAULT true,
    alert_threshold INTEGER NOT NULL DEFAULT 1,  -- failures before alerting
    -- metadata
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_monitors_type    ON it.custom_monitors(type);
CREATE INDEX IF NOT EXISTS idx_custom_monitors_enabled ON it.custom_monitors(enabled);

-- History of check results for trending
CREATE TABLE IF NOT EXISTS it.custom_monitor_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL REFERENCES it.custom_monitors(id) ON DELETE CASCADE,
    checked_at TIMESTAMPTZ DEFAULT now(),
    status VARCHAR(20) NOT NULL, -- 'ok' | 'fail'
    response_time_ms INTEGER,
    detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_monitor_results_monitor  ON it.custom_monitor_results(monitor_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitor_results_checked  ON it.custom_monitor_results(checked_at);

-- Automatically clean up results older than 90 days (housekeeping)
-- (Run periodically by the scheduler or a cron job)
-- DELETE FROM it.custom_monitor_results WHERE checked_at < now() - INTERVAL '90 days';
