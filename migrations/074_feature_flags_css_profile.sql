-- Migration 070: Feature flags, tenant CSS, user profile extension
-- Implements: feature flags per tenant, per-tenant CSS override, onboarding/streak/recent-docs/history

-- ---------------------------------------------------------------------------
-- identity.feature_flags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identity.feature_flags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    rollout_pct SMALLINT NOT NULL DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON identity.feature_flags(name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON identity.feature_flags(enabled);

-- ---------------------------------------------------------------------------
-- identity.tenants — add css_override column
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'identity' AND table_name = 'tenants' AND column_name = 'css_override'
    ) THEN
        ALTER TABLE identity.tenants ADD COLUMN css_override TEXT;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- identity.users — add onboarding/streak columns
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'onboarding_completed_at'
    ) THEN
        ALTER TABLE identity.users ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'streak_count'
    ) THEN
        ALTER TABLE identity.users ADD COLUMN streak_count INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'streak_last_date'
    ) THEN
        ALTER TABLE identity.users ADD COLUMN streak_last_date DATE;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- identity.user_recent_docs — recent documents per user (max 20, enforced in app)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identity.user_recent_docs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    doc_id        TEXT NOT NULL,
    doc_name      TEXT NOT NULL,
    doc_kind      TEXT NOT NULL,
    doc_href      TEXT NOT NULL,
    last_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, doc_id)
);

CREATE INDEX IF NOT EXISTS idx_user_recent_docs_user_id ON identity.user_recent_docs(user_id, last_opened_at DESC);

-- ---------------------------------------------------------------------------
-- identity.user_history — activity history per user (max 100, enforced in app)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identity.user_history (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    action     TEXT NOT NULL,
    entity_type TEXT,
    entity_id  TEXT,
    entity_title TEXT,
    metadata   JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_history_user_id ON identity.user_history(user_id, created_at DESC);
