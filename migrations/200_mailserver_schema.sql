-- Migration 200: Mailserver integrated schema
-- Full mail/calendar/contacts server tables for the integrated mail server.
-- Schema: mailserver.*

-- Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- CREATE EXTENSION IF NOT EXISTS "vector";

-- Create dedicated schema
CREATE SCHEMA IF NOT EXISTS mailserver;

-- ============================================================================
-- Domains & Accounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS mailserver.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    name VARCHAR(255) NOT NULL UNIQUE,
    dkim_private_key TEXT,
    dkim_selector VARCHAR(63),
    dkim_algorithm VARCHAR(10),
    spf_record TEXT,
    dmarc_policy VARCHAR(10),
    catch_all_address VARCHAR(255),
    max_accounts INT DEFAULT 0,
    is_verified BOOL DEFAULT false,
    is_active BOOL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mailserver.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES mailserver.domains(id) ON DELETE CASCADE,
    user_id UUID,
    address VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    password_hash TEXT,
    quota_bytes BIGINT DEFAULT 5368709120,
    used_bytes BIGINT DEFAULT 0,
    is_active BOOL DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mailserver.aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mailserver.accounts(id) ON DELETE CASCADE,
    alias_address VARCHAR(255) NOT NULL UNIQUE,
    domain_id UUID NOT NULL REFERENCES mailserver.domains(id) ON DELETE CASCADE,
    is_active BOOL DEFAULT true
);

-- ============================================================================
-- Messages & Storage (with dedup)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mailserver.message_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_hash CHAR(64) NOT NULL UNIQUE,
    raw_size BIGINT,
    storage_key TEXT,
    headers_json JSONB,
    body_text TEXT,
    body_html TEXT,
    body_structure JSONB,
    text_search TSVECTOR,
    embedding TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mailserver.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mailserver.accounts(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES mailserver.message_contents(id) ON DELETE CASCADE,
    message_id_header VARCHAR(255),
    in_reply_to VARCHAR(255),
    thread_id UUID,
    sender VARCHAR(255),
    sender_name VARCHAR(255),
    recipients JSONB,
    subject TEXT,
    date TIMESTAMPTZ,
    has_attachments BOOL DEFAULT false,
    spam_score FLOAT DEFAULT 0,
    spam_status VARCHAR(20),
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mailserver.mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mailserver.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    special_use VARCHAR(20),
    uid_validity INT NOT NULL,
    uid_next INT DEFAULT 1,
    highest_modseq BIGINT DEFAULT 0,
    total_messages INT DEFAULT 0,
    unread_messages INT DEFAULT 0,
    parent_id UUID REFERENCES mailserver.mailboxes(id) ON DELETE SET NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mailserver.message_mailboxes (
    message_id UUID NOT NULL REFERENCES mailserver.messages(id) ON DELETE CASCADE,
    mailbox_id UUID NOT NULL REFERENCES mailserver.mailboxes(id) ON DELETE CASCADE,
    uid INT NOT NULL,
    modseq BIGINT NOT NULL,
    flags INT DEFAULT 0,
    PRIMARY KEY (message_id, mailbox_id)
);

CREATE TABLE IF NOT EXISTS mailserver.attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES mailserver.message_contents(id) ON DELETE CASCADE,
    filename VARCHAR(255),
    content_type VARCHAR(127),
    size BIGINT,
    storage_key TEXT,
    content_disposition VARCHAR(20),
    cid VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS mailserver.threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mailserver.accounts(id) ON DELETE CASCADE,
    subject_base VARCHAR(255),
    last_message_at TIMESTAMPTZ,
    message_count INT DEFAULT 1,
    unread_count INT DEFAULT 0,
    participants JSONB
);

-- ============================================================================
-- SMTP Queue
-- ============================================================================

CREATE TABLE IF NOT EXISTS mailserver.queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES mailserver.accounts(id) ON DELETE SET NULL,
    from_address VARCHAR(255) NOT NULL,
    recipients JSONB NOT NULL,
    raw_message_key TEXT,
    priority INT DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    retry_count INT DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

-- ============================================================================
-- Sieve
-- ============================================================================

CREATE TABLE IF NOT EXISTS mailserver.sieve_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mailserver.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    script TEXT NOT NULL,
    is_active BOOL DEFAULT false,
    compiled BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Calendar (CalDAV + JMAP)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mailserver.cal_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mailserver.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7),
    description TEXT,
    timezone VARCHAR(64) DEFAULT 'Europe/Paris',
    ctag VARCHAR(64),
    sort_order INT DEFAULT 0,
    is_default BOOL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mailserver.cal_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID NOT NULL REFERENCES mailserver.cal_calendars(id) ON DELETE CASCADE,
    uid VARCHAR(255) NOT NULL UNIQUE,
    ical_data TEXT,
    summary TEXT,
    description TEXT,
    location TEXT,
    dtstart TIMESTAMPTZ,
    dtend TIMESTAMPTZ,
    rrule TEXT,
    organizer VARCHAR(255),
    attendees JSONB,
    status VARCHAR(20),
    transparency VARCHAR(20),
    etag VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Contacts (CardDAV + JMAP)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mailserver.card_addressbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mailserver.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    ctag VARCHAR(64),
    is_default BOOL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mailserver.card_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    addressbook_id UUID NOT NULL REFERENCES mailserver.card_addressbooks(id) ON DELETE CASCADE,
    uid VARCHAR(255) NOT NULL UNIQUE,
    vcard_data TEXT,
    display_name VARCHAR(255),
    emails JSONB,
    phones JSONB,
    organization VARCHAR(255),
    etag VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- DMARC Reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS mailserver.dmarc_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES mailserver.domains(id) ON DELETE CASCADE,
    reporter_org VARCHAR(255),
    report_xml TEXT,
    date_range_begin TIMESTAMPTZ,
    date_range_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Critical Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mc_text_search
    ON mailserver.message_contents USING GIN(text_search);

-- NOTE: ivfflat index requires data to exist for optimal lists parameter.
-- We create with lists=1 initially; rebuild with more lists after loading data.
-- CREATE INDEX IF NOT EXISTS idx_mc_embedding
--     ON mailserver.message_contents USING ivfflat(embedding vector_cosine_ops)
--     WITH (lists = 1);

CREATE INDEX IF NOT EXISTS idx_mm_uid
    ON mailserver.message_mailboxes(mailbox_id, uid);

CREATE INDEX IF NOT EXISTS idx_mm_modseq
    ON mailserver.message_mailboxes(mailbox_id, modseq);

CREATE INDEX IF NOT EXISTS idx_msg_thread
    ON mailserver.messages(thread_id, received_at);

CREATE INDEX IF NOT EXISTS idx_queue_retry
    ON mailserver.queue(status, next_retry_at)
    WHERE status IN ('queued', 'deferred');

CREATE INDEX IF NOT EXISTS idx_cal_events_calendar
    ON mailserver.cal_events(calendar_id, updated_at);

-- Additional useful indexes
CREATE INDEX IF NOT EXISTS idx_accounts_domain
    ON mailserver.accounts(domain_id);

CREATE INDEX IF NOT EXISTS idx_accounts_user
    ON mailserver.accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_messages_account
    ON mailserver.messages(account_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_mailboxes_account
    ON mailserver.mailboxes(account_id);

CREATE INDEX IF NOT EXISTS idx_threads_account
    ON mailserver.threads(account_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_attachments_content
    ON mailserver.attachments(content_id);

CREATE INDEX IF NOT EXISTS idx_aliases_account
    ON mailserver.aliases(account_id);

CREATE INDEX IF NOT EXISTS idx_sieve_scripts_account
    ON mailserver.sieve_scripts(account_id);

CREATE INDEX IF NOT EXISTS idx_cal_calendars_account
    ON mailserver.cal_calendars(account_id);

CREATE INDEX IF NOT EXISTS idx_card_addressbooks_account
    ON mailserver.card_addressbooks(account_id);

CREATE INDEX IF NOT EXISTS idx_card_contacts_addressbook
    ON mailserver.card_contacts(addressbook_id);

CREATE INDEX IF NOT EXISTS idx_dmarc_reports_domain
    ON mailserver.dmarc_reports(domain_id);

CREATE INDEX IF NOT EXISTS idx_domains_tenant
    ON mailserver.domains(tenant_id);
