-- Accounting module schema
-- Proper double-entry bookkeeping with chart of accounts, journal entries, and journal lines.

CREATE SCHEMA IF NOT EXISTS accounting;

CREATE TABLE accounting.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES accounting.accounts(id),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    account_type VARCHAR(30) NOT NULL,
    balance BIGINT DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'EUR',
    is_active BOOLEAN DEFAULT true,
    owner_id UUID NOT NULL,
    tenant_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_accounts_owner ON accounting.accounts(owner_id);

CREATE INDEX idx_accounts_parent ON accounting.accounts(parent_id);

CREATE TABLE accounting.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    reference VARCHAR(100),
    description TEXT,
    is_posted BOOLEAN DEFAULT false,
    owner_id UUID NOT NULL,
    tenant_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE accounting.journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES accounting.journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounting.accounts(id),
    debit BIGINT DEFAULT 0,
    credit BIGINT DEFAULT 0,
    description TEXT
);

CREATE INDEX idx_journal_lines_entry ON accounting.journal_lines(entry_id);

CREATE INDEX idx_journal_lines_account ON accounting.journal_lines(account_id);
