-- Add mail_accounts table
CREATE TABLE IF NOT EXISTS mail_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- The owner of the account
    email_address VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- 'gmail', 'outlook', 'custom'
    imap_server VARCHAR(255),
    imap_port INTEGER,
    smtp_server VARCHAR(255),
    smtp_port INTEGER,
    app_password VARCHAR(255), -- Encrypted or plain for MVP
    oauth_token TEXT,
    oauth_refresh_token TEXT,
    last_sync_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'error', 'syncing'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mail_accounts_user_id ON mail_accounts(user_id);

-- Update emails table
ALTER TABLE emails
    ADD COLUMN account_id UUID REFERENCES mail_accounts(id) ON DELETE CASCADE,
    ADD COLUMN snoozed_until TIMESTAMPTZ,
    ADD COLUMN folder VARCHAR(100) DEFAULT 'inbox',
    ADD COLUMN message_id VARCHAR(512), -- Native protocol ID (e.g., Message-ID in RFC822)
    ADD COLUMN thread_id VARCHAR(512);

-- Since we didn't have account_id before, if there are existing rows, we might need a default or just leave it NULL for now.
-- In a real production migration with existing data, we would handle data mapping. MVP: allow NULL initially.

CREATE INDEX idx_emails_account_id ON emails(account_id);
CREATE INDEX idx_emails_message_id ON emails(message_id);
