-- Migration 310: Active stack tracking for Blue/Green deployments.
-- Spec: docs/superpowers/specs/2026-04-15-multi-env-deployment-design.md

BEGIN;

CREATE TABLE IF NOT EXISTS active_stack (
    env TEXT PRIMARY KEY CHECK (env IN ('prod', 'dev')),
    active_color TEXT NOT NULL CHECK (active_color IN ('blue', 'green')),
    swapped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    swapped_by UUID REFERENCES identity.users(id)
);

-- Seed: both envs start on 'blue'.
INSERT INTO active_stack (env, active_color) VALUES ('prod', 'blue'), ('dev', 'blue');

COMMIT;
