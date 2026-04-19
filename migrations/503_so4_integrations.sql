-- SO4 W1 / Task 1 — External integrations data layer.
--
-- Adds 3 new tables + 2 columns + 2 audit triggers to support :
--   * Public links (anonymized org-chart sharing via slug URL)
--   * Webhooks (outbound HMAC-signed event fan-out per tenant)
--   * Webhook deliveries (audit log of every fan-out attempt)
--   * Person + node photo URLs (avatar + group photo)
--
-- The function `org_audit_trigger()` is defined by migration 500.
--
-- Idempotent : safe to re-run en dev (IF NOT EXISTS + DROP TRIGGER IF EXISTS).

-- ─────────────────────────────────────────────────────────────────────
-- Public links — partage public d'un sous-arbre via slug URL.
-- visibility = 'full' | 'anon' | 'compact' (anonymisation progressive).
-- access_count incrémenté à chaque GET /public/org/:slug.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_public_links (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    root_node_id        UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
    slug                VARCHAR(64) UNIQUE NOT NULL,
    visibility          VARCHAR(16) NOT NULL
        CHECK (visibility IN ('full','anon','compact')),
    allowed_origins     TEXT[] NOT NULL DEFAULT '{}',
    expires_at          TIMESTAMPTZ,
    access_count        INTEGER NOT NULL DEFAULT 0,
    created_by_user_id  UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_public_links_tenant
    ON org_public_links(tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_public_links_slug_active
    ON org_public_links(slug) WHERE revoked_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- Webhooks — souscriptions sortantes par tenant, déclenchées par
-- les events `org.*` (PgEventBus). secret = 32 chars random (HMAC).
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_webhooks (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    url              TEXT NOT NULL,
    secret           VARCHAR(64) NOT NULL,
    events           TEXT[] NOT NULL DEFAULT '{}',
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    last_delivery_at TIMESTAMPTZ,
    last_status      INTEGER,
    failure_count    INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_tenant_active
    ON org_webhooks(tenant_id, active);

-- ─────────────────────────────────────────────────────────────────────
-- Webhook deliveries — log de chaque tentative (succès et échecs).
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_webhook_deliveries (
    id            BIGSERIAL PRIMARY KEY,
    webhook_id    UUID NOT NULL REFERENCES org_webhooks(id) ON DELETE CASCADE,
    event_type    VARCHAR(64) NOT NULL,
    payload_json  JSONB NOT NULL,
    status_code   INTEGER,
    response_body TEXT,
    error_message TEXT,
    attempt       INTEGER NOT NULL DEFAULT 1,
    delivered_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook
    ON org_webhook_deliveries(webhook_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_type
    ON org_webhook_deliveries(event_type, delivered_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- Photos — colonne dédiée + indexée optionnellement.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE org_persons ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE org_nodes   ADD COLUMN IF NOT EXISTS group_photo_url TEXT;

-- ─────────────────────────────────────────────────────────────────────
-- Audit triggers — attached aux 2 nouvelles tables tenant-scopées.
-- org_webhook_deliveries n'a pas de tenant_id (dérivé via webhook_id) donc
-- on n'y attache pas le trigger générique.
-- ─────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS org_public_links_audit ON org_public_links;
DROP TRIGGER IF EXISTS org_webhooks_audit     ON org_webhooks;

CREATE TRIGGER org_public_links_audit
    AFTER INSERT OR UPDATE OR DELETE ON org_public_links
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();

CREATE TRIGGER org_webhooks_audit
    AFTER INSERT OR UPDATE OR DELETE ON org_webhooks
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
