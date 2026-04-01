-- 134: Alert escalation policies and runbooks

-- ─── Escalation Policies ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS it.escalation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    -- Level 1: 0-15 min
    l1_delay_minutes INTEGER NOT NULL DEFAULT 0,
    l1_notify_user_id UUID,
    l1_notify_email VARCHAR(200),
    l1_notify_label VARCHAR(200),   -- display label (e.g. "Assigned tech")
    -- Level 2: 15-30 min
    l2_delay_minutes INTEGER NOT NULL DEFAULT 15,
    l2_notify_user_id UUID,
    l2_notify_email VARCHAR(200),
    l2_notify_label VARCHAR(200),   -- e.g. "Team lead"
    -- Level 3: 30 min+
    l3_delay_minutes INTEGER NOT NULL DEFAULT 30,
    l3_notify_user_id UUID,
    l3_notify_email VARCHAR(200),
    l3_notify_label VARCHAR(200),   -- e.g. "Manager"
    l3_sms_number VARCHAR(30),
    -- state
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalation_policies_enabled ON it.escalation_policies(enabled);

-- Reference from alert rules
ALTER TABLE it.alert_rules ADD COLUMN IF NOT EXISTS escalation_policy_id UUID REFERENCES it.escalation_policies(id) ON DELETE SET NULL;

-- ─── Runbooks ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS it.runbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    -- JSONB steps array: [{id, type, label, config, on_success_id, on_failure_id}]
    steps JSONB NOT NULL DEFAULT '[]',
    tags TEXT[] DEFAULT '{}',
    last_run_at TIMESTAMPTZ,
    last_run_status VARCHAR(20),   -- 'success' | 'failure' | 'running'
    run_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS it.runbook_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    runbook_id UUID NOT NULL REFERENCES it.runbooks(id) ON DELETE CASCADE,
    started_by UUID,
    started_at TIMESTAMPTZ DEFAULT now(),
    finished_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'running',  -- 'running' | 'success' | 'failure' | 'cancelled'
    -- JSONB execution log: [{step_id, status, output, started_at, finished_at}]
    execution_log JSONB NOT NULL DEFAULT '[]',
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_runbook_runs_runbook ON it.runbook_runs(runbook_id, started_at DESC);
