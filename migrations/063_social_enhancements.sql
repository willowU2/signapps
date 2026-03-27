-- SignSocial enhancements: threads, signatures, recurring, media, short URLs,
-- webhooks, workspaces, time slots, content sets, team comments, API keys

-- ============================================================
-- 1. Thread support: posts can belong to a thread with ordering
-- ============================================================
ALTER TABLE social.posts
    ADD COLUMN thread_id UUID REFERENCES social.posts(id) ON DELETE SET NULL,
    ADD COLUMN thread_position INTEGER DEFAULT 0,
    ADD COLUMN thread_delay_seconds INTEGER DEFAULT 0;

CREATE INDEX idx_social_posts_thread ON social.posts(thread_id) WHERE thread_id IS NOT NULL;

-- ============================================================
-- 2. Recurring / repeat posts
-- ============================================================
ALTER TABLE social.posts
    ADD COLUMN repeat_interval_days INTEGER,
    ADD COLUMN repeat_until TIMESTAMPTZ,
    ADD COLUMN parent_post_id UUID REFERENCES social.posts(id) ON DELETE SET NULL;

-- ============================================================
-- 3. Post signatures
-- ============================================================
CREATE TABLE social.signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_auto_add BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_signatures_user ON social.signatures(user_id);

-- ============================================================
-- 4. Media library
-- ============================================================
CREATE TABLE social.media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    filename VARCHAR(512) NOT NULL,
    original_name VARCHAR(512),
    mime_type VARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    width INTEGER,
    height INTEGER,
    duration_seconds REAL,
    tags JSONB DEFAULT '[]',
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_media_user ON social.media(user_id);

-- ============================================================
-- 5. Short URLs with click tracking
-- ============================================================
CREATE TABLE social.short_urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    short_code VARCHAR(16) NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    post_id UUID REFERENCES social.posts(id) ON DELETE SET NULL,
    clicks INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_social_short_urls_code ON social.short_urls(short_code);
CREATE INDEX idx_social_short_urls_user ON social.short_urls(user_id);

-- ============================================================
-- 6. Webhooks
-- ============================================================
CREATE TABLE social.webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    events JSONB DEFAULT '["post.published"]',
    account_filter UUID REFERENCES social.accounts(id) ON DELETE SET NULL,
    secret VARCHAR(128),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    last_status_code INTEGER,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_webhooks_user ON social.webhooks(user_id);

-- ============================================================
-- 7. Workspaces (multi-brand / agency mode)
-- ============================================================
CREATE TABLE social.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(128) NOT NULL,
    avatar_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_social_workspaces_slug ON social.workspaces(slug);

CREATE TABLE social.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES social.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'member', -- owner, admin, member
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(workspace_id, user_id)
);

-- Link accounts to workspace
ALTER TABLE social.accounts
    ADD COLUMN workspace_id UUID REFERENCES social.workspaces(id) ON DELETE SET NULL;

-- Link posts to workspace
ALTER TABLE social.posts
    ADD COLUMN workspace_id UUID REFERENCES social.workspaces(id) ON DELETE SET NULL;

-- ============================================================
-- 8. Team comments on posts
-- ============================================================
CREATE TABLE social.post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES social.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES social.post_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_post_comments_post ON social.post_comments(post_id);

-- ============================================================
-- 9. Posting time slots (preferred posting times per account)
-- ============================================================
CREATE TABLE social.time_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    account_id UUID REFERENCES social.accounts(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
    hour INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
    minute INTEGER NOT NULL DEFAULT 0 CHECK (minute BETWEEN 0 AND 59),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_time_slots_user ON social.time_slots(user_id);
CREATE UNIQUE INDEX idx_social_time_slots_unique ON social.time_slots(user_id, account_id, day_of_week, hour, minute);

-- ============================================================
-- 10. Content sets (full post configuration templates)
-- ============================================================
CREATE TABLE social.content_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    media_urls JSONB DEFAULT '[]',
    hashtags JSONB DEFAULT '[]',
    target_accounts JSONB DEFAULT '[]',
    platform_overrides JSONB DEFAULT '{}',
    signature_id UUID REFERENCES social.signatures(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_content_sets_user ON social.content_sets(user_id);

-- ============================================================
-- 11. Public API keys
-- ============================================================
CREATE TABLE social.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(128) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL, -- first 8 chars for display
    scopes JSONB DEFAULT '["read", "write"]',
    rate_limit_per_hour INTEGER NOT NULL DEFAULT 30,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_social_api_keys_hash ON social.api_keys(key_hash);
CREATE INDEX idx_social_api_keys_user ON social.api_keys(user_id);
