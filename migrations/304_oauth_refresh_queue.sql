-- Migration 304: OAuth refresh queue + maintenance triggers.
--
-- The queue is a denormalized view of (source_table, source_id, expires_at,
-- consecutive_failures, disabled) maintained by triggers on the underlying
-- token tables. Single source of truth for the scheduler that performs
-- refresh attempts every 5 minutes.

CREATE TABLE IF NOT EXISTS identity.oauth_refresh_queue (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table             TEXT NOT NULL,            -- e.g., 'mail.accounts'
    source_id                UUID NOT NULL,
    tenant_id                UUID,                     -- NULL if user has no tenant_id
    user_id                  UUID NOT NULL,
    provider_key             TEXT NOT NULL,
    expires_at               TIMESTAMPTZ NOT NULL,
    last_refresh_attempt_at  TIMESTAMPTZ,
    consecutive_failures     INT NOT NULL DEFAULT 0,
    last_error               TEXT,
    disabled                 BOOLEAN NOT NULL DEFAULT false,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_table, source_id)
);

-- Hot scanner index: rows due for refresh, not disabled, not just-retried.
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_queue_expiring
    ON identity.oauth_refresh_queue (expires_at)
    WHERE disabled = false AND consecutive_failures < 10;

-- ── Trigger function: maintain queue from any token-bearing table ────────────
CREATE OR REPLACE FUNCTION identity.sync_oauth_refresh_queue() RETURNS trigger AS $$
DECLARE
    v_table       TEXT := TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;
    v_user_id     UUID;
    v_tenant_id   UUID;
    v_provider_key TEXT;
    v_expires_at  TIMESTAMPTZ;
    v_has_refresh BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM identity.oauth_refresh_queue
         WHERE source_table = v_table AND source_id = OLD.id;
        RETURN OLD;
    END IF;

    -- Per-table extraction. Real column names confirmed against live schema.
    IF v_table = 'mail.accounts' THEN
        v_user_id      := NEW.user_id;
        v_provider_key := COALESCE(NEW.oauth_provider_key, '');
        v_expires_at   := NEW.oauth_expires_at;
        v_has_refresh  := NEW.oauth_refresh_token_enc IS NOT NULL;
    ELSIF v_table = 'calendar.provider_connections' THEN
        v_user_id      := NEW.user_id;
        v_provider_key := NEW.provider;          -- VARCHAR not nullable
        v_expires_at   := NEW.token_expires_at;  -- NOT 'expires_at'
        v_has_refresh  := NEW.refresh_token_enc IS NOT NULL;
    ELSIF v_table = 'social.accounts' THEN
        v_user_id      := NEW.user_id;
        v_provider_key := NEW.platform;          -- 'platform' not 'provider'
        v_expires_at   := NEW.token_expires_at;
        v_has_refresh  := NEW.refresh_token_enc IS NOT NULL;
    ELSE
        RAISE NOTICE 'sync_oauth_refresh_queue: unknown table %', v_table;
        RETURN NEW;
    END IF;

    -- Look up tenant_id from identity.users (denormalized into queue for fast scans).
    SELECT tenant_id INTO v_tenant_id FROM identity.users WHERE id = v_user_id;

    -- Only enqueue rows that have a refresh token AND a known expiry.
    IF v_has_refresh AND v_expires_at IS NOT NULL THEN
        INSERT INTO identity.oauth_refresh_queue (
            source_table, source_id, tenant_id, user_id, provider_key, expires_at
        ) VALUES (
            v_table, NEW.id, v_tenant_id, v_user_id, v_provider_key, v_expires_at
        )
        ON CONFLICT (source_table, source_id) DO UPDATE
            SET expires_at           = EXCLUDED.expires_at,
                tenant_id            = EXCLUDED.tenant_id,
                provider_key         = EXCLUDED.provider_key,
                consecutive_failures = 0,
                last_error           = NULL,
                disabled             = false,
                updated_at           = NOW();
    ELSE
        -- Refresh token gone or expiry unknown — purge from queue
        DELETE FROM identity.oauth_refresh_queue
         WHERE source_table = v_table AND source_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Triggers on the 3 token-bearing tables ───────────────────────────────────
DROP TRIGGER IF EXISTS sync_mail_accounts_refresh_queue ON mail.accounts;
CREATE TRIGGER sync_mail_accounts_refresh_queue
    AFTER INSERT OR UPDATE OR DELETE ON mail.accounts
    FOR EACH ROW EXECUTE FUNCTION identity.sync_oauth_refresh_queue();

DROP TRIGGER IF EXISTS sync_calendar_provider_connections_refresh_queue ON calendar.provider_connections;
CREATE TRIGGER sync_calendar_provider_connections_refresh_queue
    AFTER INSERT OR UPDATE OR DELETE ON calendar.provider_connections
    FOR EACH ROW EXECUTE FUNCTION identity.sync_oauth_refresh_queue();

DROP TRIGGER IF EXISTS sync_social_accounts_refresh_queue ON social.accounts;
CREATE TRIGGER sync_social_accounts_refresh_queue
    AFTER INSERT OR UPDATE OR DELETE ON social.accounts
    FOR EACH ROW EXECUTE FUNCTION identity.sync_oauth_refresh_queue();

-- updated_at trigger on the queue itself (uses the same helper from migration 302)
DROP TRIGGER IF EXISTS oauth_refresh_queue_touch_updated_at ON identity.oauth_refresh_queue;
CREATE TRIGGER oauth_refresh_queue_touch_updated_at
    BEFORE UPDATE ON identity.oauth_refresh_queue
    FOR EACH ROW EXECUTE FUNCTION oauth_touch_updated_at();
