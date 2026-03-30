-- Migration 102: email account delegations
-- Allows an account owner to grant another user send/read access.

CREATE TABLE IF NOT EXISTS mail.delegations (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id     UUID        NOT NULL REFERENCES mail.accounts(id) ON DELETE CASCADE,
    -- user who owns the account
    owner_id       UUID        NOT NULL,
    -- user who has been granted access
    delegate_id    UUID        NOT NULL,
    -- 'read' | 'send' | 'full'
    permission     TEXT        NOT NULL DEFAULT 'read',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_delegation UNIQUE (account_id, delegate_id)
);

CREATE INDEX IF NOT EXISTS idx_delegations_account_id   ON mail.delegations(account_id);
CREATE INDEX IF NOT EXISTS idx_delegations_delegate_id  ON mail.delegations(delegate_id);
CREATE INDEX IF NOT EXISTS idx_delegations_owner_id     ON mail.delegations(owner_id);
