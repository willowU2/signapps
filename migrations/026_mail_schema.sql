-- SignApps Platform - Mail Schema Migration
-- Version: 026
-- Date: 2026-03-02

-- ============================================================================
-- Schema: Mail
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS mail;

-- Mail Accounts (IMAP/SMTP connections)
CREATE TABLE IF NOT EXISTS mail.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    email_address VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    provider VARCHAR(32) NOT NULL DEFAULT 'custom', -- 'gmail', 'outlook', 'custom'

    -- IMAP Settings
    imap_server VARCHAR(255),
    imap_port INT DEFAULT 993,
    imap_use_tls BOOLEAN DEFAULT TRUE,

    -- SMTP Settings
    smtp_server VARCHAR(255),
    smtp_port INT DEFAULT 587,
    smtp_use_tls BOOLEAN DEFAULT TRUE,

    -- Authentication
    app_password TEXT, -- Encrypted
    oauth_token TEXT,
    oauth_refresh_token TEXT,
    oauth_expires_at TIMESTAMPTZ,

    -- Sync State
    status VARCHAR(32) DEFAULT 'active', -- 'active', 'inactive', 'error'
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    sync_interval_minutes INT DEFAULT 5,

    -- Signature
    signature_html TEXT,
    signature_text TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, email_address)
);

CREATE INDEX IF NOT EXISTS idx_mail_accounts_user_id ON mail.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_mail_accounts_status ON mail.accounts(status);

-- Mail Folders
CREATE TABLE IF NOT EXISTS mail.folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES mail.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    folder_type VARCHAR(32) NOT NULL DEFAULT 'custom', -- 'inbox', 'sent', 'drafts', 'trash', 'junk', 'archive', 'custom'
    imap_path TEXT, -- IMAP folder path (e.g., "INBOX", "[Gmail]/Sent Mail")
    unread_count INT DEFAULT 0,
    total_count INT DEFAULT 0,
    parent_id UUID REFERENCES mail.folders(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(account_id, imap_path)
);

CREATE INDEX IF NOT EXISTS idx_mail_folders_account_id ON mail.folders(account_id);
CREATE INDEX IF NOT EXISTS idx_mail_folders_type ON mail.folders(folder_type);

-- Emails
CREATE TABLE IF NOT EXISTS mail.emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES mail.accounts(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES mail.folders(id) ON DELETE SET NULL,

    -- Message Identity
    message_id VARCHAR(500), -- RFC 5322 Message-ID
    in_reply_to VARCHAR(500),
    thread_id UUID, -- Internal threading
    imap_uid BIGINT, -- IMAP UID for sync

    -- Envelope
    sender VARCHAR(500) NOT NULL,
    sender_name VARCHAR(255),
    recipient TEXT NOT NULL, -- Can be multiple, comma-separated
    cc TEXT,
    bcc TEXT,
    reply_to VARCHAR(500),
    subject TEXT,

    -- Content
    body_text TEXT,
    body_html TEXT,
    snippet TEXT, -- First ~200 chars for preview

    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    is_important BOOLEAN DEFAULT FALSE,
    is_draft BOOLEAN DEFAULT FALSE,
    is_sent BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,

    -- Labels/Tags
    labels TEXT[] DEFAULT '{}',

    -- Scheduling
    snoozed_until TIMESTAMPTZ,
    scheduled_send_at TIMESTAMPTZ,

    -- Metadata
    received_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    size_bytes INT,
    has_attachments BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mail_emails_account_id ON mail.emails(account_id);
CREATE INDEX IF NOT EXISTS idx_mail_emails_folder_id ON mail.emails(folder_id);
CREATE INDEX IF NOT EXISTS idx_mail_emails_thread_id ON mail.emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_mail_emails_message_id ON mail.emails(message_id);
CREATE INDEX IF NOT EXISTS idx_mail_emails_imap_uid ON mail.emails(account_id, imap_uid);
CREATE INDEX IF NOT EXISTS idx_mail_emails_received_at ON mail.emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_emails_is_read ON mail.emails(is_read) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_mail_emails_is_starred ON mail.emails(is_starred) WHERE is_starred;
CREATE INDEX IF NOT EXISTS idx_mail_emails_snoozed ON mail.emails(snoozed_until) WHERE snoozed_until IS NOT NULL;

-- Attachments
CREATE TABLE IF NOT EXISTS mail.attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES mail.emails(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    mime_type VARCHAR(255),
    size_bytes BIGINT,
    content_id VARCHAR(255), -- For inline images
    is_inline BOOLEAN DEFAULT FALSE,
    storage_bucket VARCHAR(255),
    storage_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mail_attachments_email_id ON mail.attachments(email_id);

-- Mail Labels (custom user labels)
CREATE TABLE IF NOT EXISTS mail.labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES mail.accounts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7), -- Hex color code
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(account_id, name)
);

CREATE INDEX IF NOT EXISTS idx_mail_labels_account_id ON mail.labels(account_id);

-- Mail Rules (filters)
CREATE TABLE IF NOT EXISTS mail.rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES mail.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    priority INT DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,

    -- Conditions (JSONB for flexibility)
    conditions JSONB NOT NULL, -- {"from": "pattern", "subject": "pattern", "has_attachment": true, etc.}

    -- Actions
    actions JSONB NOT NULL, -- {"move_to": "folder_id", "label": "label_name", "mark_read": true, "delete": true, etc.}

    stop_processing BOOLEAN DEFAULT FALSE, -- Stop other rules if this matches
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mail_rules_account_id ON mail.rules(account_id);

-- Create default folders for new accounts (trigger function)
CREATE OR REPLACE FUNCTION mail.create_default_folders()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO mail.folders (account_id, name, folder_type, imap_path) VALUES
        (NEW.id, 'Inbox', 'inbox', 'INBOX'),
        (NEW.id, 'Sent', 'sent', NULL),
        (NEW.id, 'Drafts', 'drafts', NULL),
        (NEW.id, 'Trash', 'trash', NULL),
        (NEW.id, 'Junk', 'junk', NULL),
        (NEW.id, 'Archive', 'archive', NULL);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_folders
    AFTER INSERT ON mail.accounts
    FOR EACH ROW
    EXECUTE FUNCTION mail.create_default_folders();
