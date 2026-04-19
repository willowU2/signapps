-- S1 W1 / Task 6 — Canonical `org_provisioning_log` table.
--
-- Journal of cross-service provisioning fan-out (mail, chat, drive,
-- ...). One row per (person, service, attempt).
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS org_provisioning_log (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    person_id  UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    topic      TEXT NOT NULL,
    service    TEXT NOT NULL,
    status     TEXT NOT NULL,
    error      TEXT,
    attempts   INT  NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prov_log_person ON org_provisioning_log(person_id);
CREATE INDEX IF NOT EXISTS idx_prov_log_status ON org_provisioning_log(status);
