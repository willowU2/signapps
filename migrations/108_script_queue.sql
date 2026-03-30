-- Migration 108: Script execution queue for remote agent script dispatch

CREATE TABLE IF NOT EXISTS it.script_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_id UUID NOT NULL REFERENCES it.hardware(id) ON DELETE CASCADE,
    script_type VARCHAR(20) NOT NULL DEFAULT 'bash',
    script_content TEXT NOT NULL,
    timeout_seconds INTEGER NOT NULL DEFAULT 300,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    stdout TEXT,
    stderr TEXT,
    exit_code INTEGER,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    queued_by UUID
);
CREATE INDEX IF NOT EXISTS idx_script_queue_hw ON it.script_queue(hardware_id, status);

-- EA6: Enrollment tokens for secure agent onboarding
CREATE TABLE IF NOT EXISTS it.enrollment_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(100) NOT NULL UNIQUE,
    label VARCHAR(100),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    hardware_id UUID REFERENCES it.hardware(id) ON DELETE SET NULL,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enrollment_tokens_token ON it.enrollment_tokens(token);
