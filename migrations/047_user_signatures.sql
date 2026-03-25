-- SignApps Platform - User Signatures Migration
-- Version: 047
-- Feature: AQ-SIGRT — User signature/stamp management

CREATE TABLE IF NOT EXISTS identity.user_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    signature_type TEXT NOT NULL DEFAULT 'drawn'
        CHECK (signature_type IN ('drawn', 'typed', 'image', 'stamp')),
    image_data TEXT,
    storage_ref TEXT,
    display_name TEXT,
    title TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_signatures_user ON identity.user_signatures(user_id);
