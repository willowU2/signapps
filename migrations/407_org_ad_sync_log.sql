-- S1 W1 / Task 6 — Canonical `org_ad_sync_log` table.
--
-- Audit trail of every entry processed by the AD sync engine. One
-- row per (run_id, entry_dn, direction). Used by the
-- `ad-sync-debug` skill in W3.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS org_ad_sync_log (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    run_id     UUID NOT NULL,
    entry_dn   TEXT NOT NULL,
    direction  TEXT NOT NULL,
    status     TEXT NOT NULL,
    diff       JSONB NOT NULL,
    error      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_sync_log_run ON org_ad_sync_log(run_id);
CREATE INDEX IF NOT EXISTS idx_ad_sync_log_status ON org_ad_sync_log(status);
