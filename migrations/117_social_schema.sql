-- Migration 117: Social media management schema
-- 20 tables + 1 view for signapps-social service (port 3019)

CREATE SCHEMA IF NOT EXISTS social;

-- ---------------------------------------------------------------------------
-- 1. accounts — connected social media accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.accounts (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL,
    platform            VARCHAR     NOT NULL,
    platform_user_id    VARCHAR,
    username            VARCHAR,
    display_name        VARCHAR,
    avatar_url          TEXT,
    access_token        TEXT,
    refresh_token       TEXT,
    token_expires_at    TIMESTAMPTZ,
    platform_config     JSONB       NOT NULL DEFAULT '{}',
    is_active           BOOLEAN     NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id    ON social.accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform   ON social.accounts (platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_active     ON social.accounts (user_id, is_active);

-- ---------------------------------------------------------------------------
-- 2. posts — scheduled / published posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.posts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL,
    status          VARCHAR     NOT NULL DEFAULT 'draft',
    content         TEXT        NOT NULL DEFAULT '',
    media_urls      JSONB       NOT NULL DEFAULT '[]',
    hashtags        JSONB       NOT NULL DEFAULT '[]',
    scheduled_at    TIMESTAMPTZ,
    published_at    TIMESTAMPTZ,
    error_message   TEXT,
    is_evergreen    BOOLEAN     NOT NULL DEFAULT false,
    template_id     UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_user_id      ON social.posts (user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status       ON social.posts (status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled    ON social.posts (scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_published    ON social.posts (published_at) WHERE published_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. post_targets — per-account publishing targets for a post
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.post_targets (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id             UUID        NOT NULL REFERENCES social.posts (id) ON DELETE CASCADE,
    account_id          UUID        NOT NULL REFERENCES social.accounts (id) ON DELETE CASCADE,
    platform_post_id    VARCHAR,
    platform_url        TEXT,
    content_override    TEXT,
    status              VARCHAR     NOT NULL DEFAULT 'pending',
    error_message       TEXT,
    published_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_social_post_targets_post_id    ON social.post_targets (post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_targets_account_id ON social.post_targets (account_id);
CREATE INDEX IF NOT EXISTS idx_social_post_targets_status     ON social.post_targets (status);

-- ---------------------------------------------------------------------------
-- 4. post_analytics — per-target engagement metrics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.post_analytics (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_target_id      UUID        NOT NULL REFERENCES social.post_targets (id) ON DELETE CASCADE,
    impressions         INTEGER,
    reach               INTEGER,
    likes               INTEGER,
    comments            INTEGER,
    shares              INTEGER,
    clicks              INTEGER,
    saves               INTEGER,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_post_analytics_target ON social.post_analytics (post_target_id);

-- ---------------------------------------------------------------------------
-- 5. inbox — incoming social messages, comments, DMs
--    (used directly by inbox handlers as social.inbox)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.inbox (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          UUID        NOT NULL REFERENCES social.accounts (id) ON DELETE CASCADE,
    platform_item_id    VARCHAR,
    item_type           VARCHAR     NOT NULL,
    author_name         VARCHAR,
    author_avatar       TEXT,
    content             TEXT,
    post_id             UUID,
    parent_id           UUID,
    is_read             BOOLEAN     NOT NULL DEFAULT false,
    sentiment           VARCHAR,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_inbox_account_id  ON social.inbox (account_id);
CREATE INDEX IF NOT EXISTS idx_social_inbox_is_read     ON social.inbox (account_id, is_read);
CREATE INDEX IF NOT EXISTS idx_social_inbox_received_at ON social.inbox (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_inbox_item_type   ON social.inbox (item_type);

-- View alias used by analytics and automation handlers
CREATE OR REPLACE VIEW social.inbox_items AS SELECT * FROM social.inbox;

-- ---------------------------------------------------------------------------
-- 6. analytics — daily per-account analytics snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.analytics (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID        NOT NULL REFERENCES social.accounts (id) ON DELETE CASCADE,
    date            DATE        NOT NULL,
    followers       INTEGER,
    following       INTEGER,
    posts_count     INTEGER,
    impressions     INTEGER,
    reach           INTEGER,
    engagement      INTEGER,
    clicks          INTEGER,
    shares          INTEGER,
    UNIQUE (account_id, date)
);

CREATE INDEX IF NOT EXISTS idx_social_analytics_account_date ON social.analytics (account_id, date DESC);

-- ---------------------------------------------------------------------------
-- 7. templates — reusable post templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.templates (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL,
    name        VARCHAR     NOT NULL,
    content     TEXT        NOT NULL DEFAULT '',
    hashtags    JSONB       NOT NULL DEFAULT '[]',
    category    VARCHAR,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_templates_user_id  ON social.templates (user_id);
CREATE INDEX IF NOT EXISTS idx_social_templates_category ON social.templates (category) WHERE category IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 8. rss_feeds — RSS/Atom feeds for auto-posting
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.rss_feeds (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID        NOT NULL,
    feed_url                TEXT        NOT NULL,
    name                    VARCHAR,
    target_accounts         JSONB       NOT NULL DEFAULT '[]',
    post_template           TEXT,
    is_active               BOOLEAN     NOT NULL DEFAULT true,
    last_checked_at         TIMESTAMPTZ,
    last_item_guid          TEXT,
    check_interval_minutes  INTEGER     NOT NULL DEFAULT 60,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_rss_feeds_user_id  ON social.rss_feeds (user_id);
CREATE INDEX IF NOT EXISTS idx_social_rss_feeds_active   ON social.rss_feeds (is_active, last_checked_at);

-- ---------------------------------------------------------------------------
-- 9. short_urls — link shortener for posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.short_urls (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL,
    short_code      VARCHAR     NOT NULL UNIQUE,
    original_url    TEXT        NOT NULL,
    post_id         UUID,
    clicks          INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_short_urls_user_id    ON social.short_urls (user_id);
CREATE INDEX IF NOT EXISTS idx_social_short_urls_short_code ON social.short_urls (short_code);
CREATE INDEX IF NOT EXISTS idx_social_short_urls_post_id    ON social.short_urls (post_id) WHERE post_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 10. webhooks — outbound event webhooks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.webhooks (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL,
    name                VARCHAR     NOT NULL,
    url                 TEXT        NOT NULL,
    events              JSONB       NOT NULL DEFAULT '["post.published"]',
    account_filter      UUID,
    secret              TEXT,
    is_active           BOOLEAN     NOT NULL DEFAULT true,
    last_triggered_at   TIMESTAMPTZ,
    last_status_code    INTEGER,
    failure_count       INTEGER     NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_webhooks_user_id ON social.webhooks (user_id);
CREATE INDEX IF NOT EXISTS idx_social_webhooks_active  ON social.webhooks (is_active);

-- ---------------------------------------------------------------------------
-- 11. workspaces — team workspaces for collaborative social management
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.workspaces (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID        NOT NULL,
    name        VARCHAR     NOT NULL,
    slug        VARCHAR     NOT NULL UNIQUE,
    avatar_url  TEXT,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_workspaces_owner_id ON social.workspaces (owner_id);
CREATE INDEX IF NOT EXISTS idx_social_workspaces_slug     ON social.workspaces (slug);

-- ---------------------------------------------------------------------------
-- 12. workspace_members — membership in workspaces
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.workspace_members (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID        NOT NULL REFERENCES social.workspaces (id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL,
    role            VARCHAR     NOT NULL DEFAULT 'member',
    invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at     TIMESTAMPTZ,
    UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_social_workspace_members_workspace ON social.workspace_members (workspace_id);
CREATE INDEX IF NOT EXISTS idx_social_workspace_members_user_id   ON social.workspace_members (user_id);

-- ---------------------------------------------------------------------------
-- 13. api_keys — API keys for external integrations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.api_keys (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL,
    name                VARCHAR     NOT NULL,
    key_hash            VARCHAR     NOT NULL UNIQUE,
    key_prefix          VARCHAR     NOT NULL,
    scopes              JSONB       NOT NULL DEFAULT '["read","write"]',
    rate_limit_per_hour INTEGER     NOT NULL DEFAULT 30,
    last_used_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    is_active           BOOLEAN     NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_api_keys_user_id   ON social.api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_social_api_keys_key_hash  ON social.api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_social_api_keys_active    ON social.api_keys (is_active);

-- ---------------------------------------------------------------------------
-- 14. media — media library (images, videos) for posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.media (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL,
    filename            VARCHAR     NOT NULL,
    original_name       VARCHAR,
    mime_type           VARCHAR     NOT NULL,
    size_bytes          BIGINT      NOT NULL DEFAULT 0,
    url                 TEXT        NOT NULL,
    thumbnail_url       TEXT,
    width               INTEGER,
    height              INTEGER,
    duration_seconds    REAL,
    tags                JSONB       NOT NULL DEFAULT '[]',
    usage_count         INTEGER     NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_media_user_id   ON social.media (user_id);
CREATE INDEX IF NOT EXISTS idx_social_media_mime_type ON social.media (user_id, mime_type);

-- ---------------------------------------------------------------------------
-- 15. content_sets — multi-platform content sets (one piece, multiple targets)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.content_sets (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL,
    name                VARCHAR     NOT NULL,
    description         TEXT,
    content             TEXT        NOT NULL DEFAULT '',
    media_urls          JSONB       NOT NULL DEFAULT '[]',
    hashtags            JSONB       NOT NULL DEFAULT '[]',
    target_accounts     JSONB       NOT NULL DEFAULT '[]',
    platform_overrides  JSONB       NOT NULL DEFAULT '{}',
    signature_id        UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_content_sets_user_id ON social.content_sets (user_id);

-- ---------------------------------------------------------------------------
-- 16. signatures — post signatures / footers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.signatures (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL,
    name        VARCHAR     NOT NULL,
    content     TEXT        NOT NULL DEFAULT '',
    is_auto_add BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_signatures_user_id ON social.signatures (user_id);

-- ---------------------------------------------------------------------------
-- 17. time_slots — optimal posting time preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.time_slots (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL,
    account_id  UUID,
    day_of_week INTEGER     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    hour        INTEGER     NOT NULL CHECK (hour BETWEEN 0 AND 23),
    minute      INTEGER     NOT NULL DEFAULT 0 CHECK (minute BETWEEN 0 AND 59),
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, account_id, day_of_week, hour, minute)
);

CREATE INDEX IF NOT EXISTS idx_social_time_slots_user_id ON social.time_slots (user_id);

-- ---------------------------------------------------------------------------
-- 18. post_comments — internal team review comments on posts (not platform comments)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.post_comments (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id             UUID        NOT NULL REFERENCES social.posts (id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL,
    content             TEXT        NOT NULL,
    parent_comment_id   UUID        REFERENCES social.post_comments (id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_post_comments_post_id ON social.post_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_comments_user_id ON social.post_comments (user_id);

-- ---------------------------------------------------------------------------
-- 19. ai_threads — AI conversation threads for content generation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social.ai_threads (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL,
    title       VARCHAR     NOT NULL,
    messages    JSONB       NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_ai_threads_user_id    ON social.ai_threads (user_id);
CREATE INDEX IF NOT EXISTS idx_social_ai_threads_updated_at ON social.ai_threads (user_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- 20. inbox_items table does not physically exist; it is a VIEW over social.inbox
--     (created above). This satisfies both the inbox handler (social.inbox) and
--     the analytics/automation handlers (social.inbox_items).
-- ---------------------------------------------------------------------------
