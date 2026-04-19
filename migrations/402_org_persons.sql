-- S1 W1 / Task 3 — Canonical `org_persons` table.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS org_persons (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    user_id    UUID UNIQUE,
    email      TEXT NOT NULL,
    first_name TEXT,
    last_name  TEXT,
    dn         TEXT,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    active     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_persons_tenant_email ON org_persons(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_org_persons_dn ON org_persons(dn);
