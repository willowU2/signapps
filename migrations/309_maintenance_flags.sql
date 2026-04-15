-- Migration 309: Shared maintenance flag storage (replaces in-process cache).
-- Both signapps-deploy (writer) and signapps-proxy (reader) hit this table
-- so the maintenance page actually shows up to end-users during a deploy.

BEGIN;

CREATE TABLE maintenance_flags (
    env TEXT PRIMARY KEY CHECK (env IN ('prod', 'dev')),
    enabled BOOLEAN NOT NULL DEFAULT false,
    set_by UUID REFERENCES identity.users(id),
    set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

-- Seed the 2 envs as disabled so reads never return NULL
INSERT INTO maintenance_flags (env, enabled) VALUES ('prod', false), ('dev', false);

COMMIT;
