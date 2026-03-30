-- Migration 101: email aliases per account

CREATE TABLE IF NOT EXISTS mail.aliases (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id    UUID        NOT NULL REFERENCES mail.accounts(id) ON DELETE CASCADE,
    alias_email   TEXT        NOT NULL,
    display_name  TEXT        NOT NULL DEFAULT '',
    is_default    BOOLEAN     NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_alias_email_account UNIQUE (account_id, alias_email)
);

CREATE INDEX IF NOT EXISTS idx_aliases_account_id ON mail.aliases(account_id);

-- Ensure only one alias per account is marked as default.
CREATE UNIQUE INDEX IF NOT EXISTS uq_aliases_default_per_account
    ON mail.aliases(account_id)
    WHERE is_default = true;
