-- 131: Remediation playbooks
-- Structured runbooks: sequences of steps with configurable failure handling

CREATE TABLE IF NOT EXISTS it.playbooks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    steps       JSONB NOT NULL DEFAULT '[]',
    -- steps: [{action_type, config{}, on_failure: 'continue'|'stop'|'escalate'}]
    enabled     BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS it.playbook_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES it.playbooks(id) ON DELETE CASCADE,
    hardware_id UUID REFERENCES it.hardware(id) ON DELETE SET NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'running', -- running, completed, failed, escalated
    step_results JSONB NOT NULL DEFAULT '[]',
    -- step_results: [{step_index, status, output, error, started_at, completed_at}]
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_playbook_runs_playbook ON it.playbook_runs(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_runs_hardware ON it.playbook_runs(hardware_id);
CREATE INDEX IF NOT EXISTS idx_playbook_runs_status   ON it.playbook_runs(status);
