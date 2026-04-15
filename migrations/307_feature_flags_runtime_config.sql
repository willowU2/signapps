-- Migration 307: Feature flags + runtime config tables
-- Spec: docs/superpowers/specs/2026-04-15-multi-env-deployment-design.md section 3.3

BEGIN;

CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    env TEXT NOT NULL CHECK (env IN ('prod', 'dev', 'all')),
    enabled BOOLEAN NOT NULL DEFAULT false,
    rollout_percent INT NOT NULL DEFAULT 100 CHECK (rollout_percent BETWEEN 0 AND 100),
    target_orgs UUID[] NOT NULL DEFAULT '{}',
    target_users UUID[] NOT NULL DEFAULT '{}',
    description TEXT,
    created_by UUID REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (key, env)
);

CREATE INDEX idx_feature_flags_key ON feature_flags (key);

CREATE TABLE runtime_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    env TEXT NOT NULL CHECK (env IN ('prod', 'dev', 'all')),
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES identity.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (key, env)
);

CREATE INDEX idx_runtime_config_key ON runtime_config (key);

COMMIT;
