-- Vault Enterprise schema
-- Task 1: Complete vault schema with encryption hierarchy

CREATE SCHEMA IF NOT EXISTS vault;

-- Enums
DO $$ BEGIN
    CREATE TYPE vault.item_type AS ENUM (
        'login', 'secure_note', 'card', 'ssh_key', 'api_token', 'identity', 'passkey'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE vault.share_type AS ENUM ('person', 'group');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE vault.access_level AS ENUM ('full', 'use_only', 'read_only');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE vault.audit_action AS ENUM (
        'view', 'copy', 'use', 'browse', 'create', 'update', 'delete',
        'share', 'unshare', 'totp_generate'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User keys (encryption key hierarchy)
CREATE TABLE IF NOT EXISTS vault.user_keys (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL UNIQUE REFERENCES identity.users(id) ON DELETE CASCADE,
    encrypted_sym_key    BYTEA NOT NULL,
    encrypted_private_key BYTEA NOT NULL,
    public_key           TEXT NOT NULL,
    kdf_type             TEXT DEFAULT 'pbkdf2',
    kdf_iterations       INT DEFAULT 600000,
    has_master_password  BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Folders (names encrypted)
CREATE TABLE IF NOT EXISTS vault.folders (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    name       BYTEA NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items (all sensitive fields encrypted)
CREATE TABLE IF NOT EXISTS vault.items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id         UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    folder_id        UUID REFERENCES vault.folders(id) ON DELETE SET NULL,
    item_type        vault.item_type NOT NULL,
    name             BYTEA NOT NULL,
    data             BYTEA NOT NULL,
    notes            BYTEA,
    fields           BYTEA,
    item_key         BYTEA,
    totp_secret      BYTEA,
    password_history BYTEA,
    uri              BYTEA,
    favorite         BOOLEAN DEFAULT FALSE,
    reprompt         BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_items_owner  ON vault.items(owner_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_folder ON vault.items(folder_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_type   ON vault.items(item_type);

-- Shares
CREATE TABLE IF NOT EXISTS vault.shares (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id       UUID NOT NULL REFERENCES vault.items(id) ON DELETE CASCADE,
    share_type    vault.share_type NOT NULL,
    grantee_id    UUID NOT NULL,
    access_level  vault.access_level NOT NULL,
    encrypted_key BYTEA NOT NULL,
    granted_by    UUID NOT NULL REFERENCES identity.users(id),
    expires_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_shares_item    ON vault.shares(item_id);
CREATE INDEX IF NOT EXISTS idx_vault_shares_grantee ON vault.shares(share_type, grantee_id);

-- Org keys (per-member encrypted org symmetric key)
CREATE TABLE IF NOT EXISTS vault.org_keys (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id          UUID NOT NULL,
    member_user_id    UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    encrypted_org_key BYTEA NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, member_user_id)
);

-- Browse sessions (use_only proxy)
CREATE TABLE IF NOT EXISTS vault.browse_sessions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token              TEXT NOT NULL UNIQUE,
    item_id            UUID NOT NULL REFERENCES vault.items(id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    target_url         TEXT NOT NULL,
    injected_username  TEXT,
    injected_password  TEXT,
    injected_totp_secret TEXT,
    expires_at         TIMESTAMPTZ NOT NULL,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_browse_token   ON vault.browse_sessions(token);
CREATE INDEX IF NOT EXISTS idx_vault_browse_expires ON vault.browse_sessions(expires_at);

-- Audit log
CREATE TABLE IF NOT EXISTS vault.audit_log (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id    UUID,
    action     vault.audit_action NOT NULL,
    actor_id   UUID NOT NULL REFERENCES identity.users(id),
    actor_ip   INET,
    details    JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_audit_item    ON vault.audit_log(item_id);
CREATE INDEX IF NOT EXISTS idx_vault_audit_actor   ON vault.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_vault_audit_created ON vault.audit_log(created_at);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION vault.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT; BEGIN
    FOR t IN SELECT unnest(ARRAY['user_keys', 'items']) LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_vault_%s_updated ON vault.%s',
            t, t
        );
        EXECUTE format(
            'CREATE TRIGGER trg_vault_%s_updated BEFORE UPDATE ON vault.%s FOR EACH ROW EXECUTE FUNCTION vault.update_updated_at()',
            t, t
        );
    END LOOP;
END $$;
