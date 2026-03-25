-- SignApps Platform - Spam Model Migration
-- Version: 042
-- Date: 2026-03-25

-- ============================================================================
-- Spam ML Model: Per-account Naive Bayes word frequency table
-- ============================================================================

CREATE TABLE IF NOT EXISTS mail.spam_model (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mail.accounts(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    spam_count INTEGER NOT NULL DEFAULT 0,
    ham_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, word)
);

CREATE INDEX idx_spam_model_account ON mail.spam_model(account_id);

-- Spam filter settings per account
CREATE TABLE IF NOT EXISTS mail.spam_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mail.accounts(id) ON DELETE CASCADE UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    threshold DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    total_spam INTEGER NOT NULL DEFAULT 0,
    total_ham INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spam_settings_account ON mail.spam_settings(account_id);
