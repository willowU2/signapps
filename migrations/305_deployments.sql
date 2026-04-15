-- Migration 305: Deployment tracking tables
-- Spec: docs/superpowers/specs/2026-04-15-multi-env-deployment-design.md section 3.5

BEGIN;

CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    env TEXT NOT NULL CHECK (env IN ('prod', 'dev')),
    version TEXT NOT NULL,
    git_sha TEXT NOT NULL,
    triggered_by UUID REFERENCES identity.users(id),
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed', 'rolled_back')),
    previous_version TEXT,
    migrations_applied TEXT[] NOT NULL DEFAULT '{}',
    duration_seconds INT,
    error_message TEXT,
    logs_path TEXT
);

CREATE INDEX idx_deployments_env_time ON deployments (env, triggered_at DESC);
CREATE INDEX idx_deployments_status ON deployments (status) WHERE status IN ('pending', 'running');

CREATE TABLE deployment_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID REFERENCES deployments(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_id UUID REFERENCES identity.users(id),
    actor_ip INET,
    actor_user_agent TEXT,
    payload JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_deployment ON deployment_audit_log (deployment_id);
CREATE INDEX idx_audit_actor_time ON deployment_audit_log (actor_id, timestamp DESC);

COMMIT;
