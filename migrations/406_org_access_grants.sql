-- S1 W1 / Task 6 — Canonical `org_access_grants` table.
--
-- Signed, time-boxed share tokens. The `token_hash` column stores
-- the SHA-256 of the HMAC-signed token returned to the consumer
-- so a database leak does not reveal the live tokens.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS org_access_grants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    granted_by    UUID NOT NULL REFERENCES org_persons(id),
    granted_to    UUID REFERENCES org_persons(id),
    resource_type TEXT NOT NULL,
    resource_id   UUID NOT NULL,
    permissions   JSONB NOT NULL,
    token_hash    TEXT NOT NULL UNIQUE,
    expires_at    TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_grants_resource ON org_access_grants(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_grants_tenant ON org_access_grants(tenant_id);
