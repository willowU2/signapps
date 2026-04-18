-- Migration 306: Scheduled maintenance windows
-- Spec: docs/superpowers/specs/2026-04-15-multi-env-deployment-design.md section 4.5

BEGIN;

CREATE TABLE IF NOT EXISTS scheduled_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    env TEXT NOT NULL CHECK (env IN ('prod', 'dev')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 720),
    message TEXT NOT NULL,
    created_by UUID REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')) DEFAULT 'scheduled',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_scheduled_maintenance_env_status_time
    ON scheduled_maintenance (env, status, scheduled_at);

-- Partial index for the scheduler worker's hot query (find next window to run)
CREATE INDEX IF NOT EXISTS idx_scheduled_maintenance_next
    ON scheduled_maintenance (scheduled_at)
    WHERE status IN ('scheduled', 'active');

COMMIT;
