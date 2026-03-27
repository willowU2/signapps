-- Migration 072: mail.pgp_configs — PGP public key + config sync
-- Private keys stay client-side (browser encrypted storage).

CREATE TABLE IF NOT EXISTS mail.pgp_configs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id     UUID NOT NULL UNIQUE REFERENCES mail.accounts(id) ON DELETE CASCADE,
    enabled        BOOLEAN NOT NULL DEFAULT false,
    public_key_pem TEXT,
    fingerprint    TEXT,
    algorithm      TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pgp_configs_account_id ON mail.pgp_configs(account_id);
