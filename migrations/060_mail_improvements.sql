-- SignApps Platform - Mail Improvements Migration
-- Version: 060
-- Date: 2026-04-01
--
-- Purpose: Add missing mail tables (aliases, delegations, email tracking,
-- recurring emails, spam model, spam settings, PGP configs) and performance
-- indexes for the mail service.
-- Uses IF NOT EXISTS throughout for idempotency.

-- ============================================================================
-- 1. mail.aliases — Email aliases per account
-- ============================================================================
CREATE TABLE IF NOT EXISTS mail.aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mail.accounts(id) ON DELETE CASCADE,
    alias_email TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, alias_email)
);

-- ============================================================================
-- 2. mail.delegations — Shared mailbox / delegation access
-- ============================================================================
CREATE TABLE IF NOT EXISTS mail.delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mail.accounts(id) ON DELETE CASCADE,
    delegate_user_id UUID NOT NULL,
    permissions TEXT NOT NULL DEFAULT 'read',
    granted_by UUID NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, delegate_user_id)
);

-- ============================================================================
-- 3. mail.email_opens — Read-receipt / open tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS mail.email_opens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL REFERENCES mail.emails(id) ON DELETE CASCADE,
    tracking_id UUID NOT NULL UNIQUE,
    opened_at TIMESTAMPTZ,
    ip_address TEXT,
    user_agent TEXT,
    open_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_opens_email_id ON mail.email_opens(email_id);
CREATE INDEX IF NOT EXISTS idx_email_opens_tracking_id ON mail.email_opens(tracking_id);

-- ============================================================================
-- 4. mail.recurring_emails — Scheduled recurring sends (cron-based)
-- ============================================================================
CREATE TABLE IF NOT EXISTS mail.recurring_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mail.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    recipient TEXT NOT NULL,
    cc TEXT,
    bcc TEXT,
    subject TEXT NOT NULL,
    body_text TEXT,
    body_html TEXT,
    cron_expr TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sent_at TIMESTAMPTZ,
    next_send_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. mail.spam_model — Per-account Naive Bayes word frequency
-- ============================================================================
CREATE TABLE IF NOT EXISTS mail.spam_model (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mail.accounts(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    spam_count INT NOT NULL DEFAULT 0,
    ham_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, word)
);

-- ============================================================================
-- 6. mail.spam_settings — Per-account spam filter configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS mail.spam_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mail.accounts(id) ON DELETE CASCADE UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    threshold FLOAT NOT NULL DEFAULT 0.5,
    total_spam INT NOT NULL DEFAULT 0,
    total_ham INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. mail.pgp_configs — PGP encryption settings per account
-- ============================================================================
CREATE TABLE IF NOT EXISTS mail.pgp_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mail.accounts(id) ON DELETE CASCADE UNIQUE,
    public_key TEXT NOT NULL,
    fingerprint TEXT,
    encrypt_by_default BOOLEAN NOT NULL DEFAULT false,
    sign_by_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. Performance indexes for mail.emails
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_emails_account_received ON mail.emails(account_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_folder_read_deleted ON mail.emails(folder_id, is_read, is_deleted);
CREATE INDEX IF NOT EXISTS idx_emails_account_uid ON mail.emails(account_id, imap_uid);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON mail.emails(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON mail.emails(message_id) WHERE message_id IS NOT NULL;

-- ============================================================================
-- 9. Template uniqueness constraint
-- ============================================================================
ALTER TABLE mail.email_templates ADD CONSTRAINT IF NOT EXISTS uq_templates_account_name UNIQUE (account_id, name);

-- ============================================================================
-- 10. Ensure oauth_expires_at column exists on mail.accounts
-- ============================================================================
ALTER TABLE mail.accounts ADD COLUMN IF NOT EXISTS oauth_expires_at TIMESTAMPTZ;
