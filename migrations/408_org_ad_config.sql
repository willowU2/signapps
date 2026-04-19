-- S1 W1 / Task 6 — Canonical `org_ad_config` table.
--
-- Per-tenant LDAP/AD synchronization configuration. The bind
-- password is stored encrypted (BYTEA via signapps-keystore /
-- AES-256-GCM); the plaintext is never materialised in this table.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS org_ad_config (
    tenant_id         UUID PRIMARY KEY,
    mode              TEXT NOT NULL DEFAULT 'off',
    ldap_url          TEXT,
    bind_dn           TEXT,
    bind_password_enc BYTEA,
    base_dn           TEXT,
    user_filter       TEXT,
    ou_filter         TEXT,
    sync_interval_sec INT  NOT NULL DEFAULT 300,
    conflict_strategy TEXT NOT NULL DEFAULT 'org_wins',
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
