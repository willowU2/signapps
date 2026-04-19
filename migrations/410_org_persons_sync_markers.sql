-- S1 W3 / Task 21 — Sync markers on org_persons to prevent AD↔Org
-- ping-pong during bidirectional synchronization.
--
-- `last_synced_by` records which side applied the most recent
-- change (`"ad"` | `"org"`), and `last_synced_at` stamps the moment
-- so the OrgToAd side can apply a debounce window (30 s) and skip
-- rows that were just pulled from AD.
--
-- Idempotent: safe to re-run.

ALTER TABLE org_persons ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE org_persons ADD COLUMN IF NOT EXISTS last_synced_by TEXT;
