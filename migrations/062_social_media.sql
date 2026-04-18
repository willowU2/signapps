CREATE SCHEMA IF NOT EXISTS social;

-- Connected social accounts
CREATE TABLE IF NOT EXISTS social.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    platform VARCHAR(32) NOT NULL, -- twitter, facebook, instagram, linkedin, mastodon, bluesky
    platform_user_id VARCHAR(255),
    username VARCHAR(255),
    display_name VARCHAR(255),
    avatar_url TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    platform_config JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Posts (drafts, scheduled, published)
CREATE TABLE IF NOT EXISTS social.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'draft', -- draft, scheduled, publishing, published, failed
    content TEXT NOT NULL,
    media_urls JSONB DEFAULT '[]',
    hashtags JSONB DEFAULT '[]',
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    error_message TEXT,
    is_evergreen BOOLEAN NOT NULL DEFAULT false,
    template_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-platform post targets (one post can go to multiple platforms)
CREATE TABLE IF NOT EXISTS social.post_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES social.posts(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES social.accounts(id) ON DELETE CASCADE,
    platform_post_id VARCHAR(255), -- ID on the platform after publishing
    platform_url TEXT, -- URL on the platform
    content_override TEXT, -- platform-specific content if different
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, published, failed
    error_message TEXT,
    published_at TIMESTAMPTZ
);

-- Inbox (comments, mentions, DMs)
CREATE TABLE IF NOT EXISTS social.inbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES social.accounts(id) ON DELETE CASCADE,
    platform_item_id VARCHAR(255),
    item_type VARCHAR(32) NOT NULL, -- comment, mention, dm, reply
    author_name VARCHAR(255),
    author_avatar TEXT,
    content TEXT,
    post_id UUID REFERENCES social.posts(id),
    parent_id UUID REFERENCES social.inbox(id),
    is_read BOOLEAN NOT NULL DEFAULT false,
    sentiment VARCHAR(16), -- positive, neutral, negative
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Analytics snapshots
CREATE TABLE IF NOT EXISTS social.analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES social.accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    followers INTEGER DEFAULT 0,
    following INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    engagement INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    UNIQUE(account_id, date)
);

-- Post analytics
CREATE TABLE IF NOT EXISTS social.post_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_target_id UUID NOT NULL REFERENCES social.post_targets(id) ON DELETE CASCADE,
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RSS feeds for auto-posting
CREATE TABLE IF NOT EXISTS social.rss_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    feed_url TEXT NOT NULL,
    name VARCHAR(255),
    target_accounts JSONB DEFAULT '[]', -- account IDs to post to
    post_template TEXT DEFAULT '{{title}} {{link}}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_checked_at TIMESTAMPTZ,
    last_item_guid TEXT,
    check_interval_minutes INTEGER NOT NULL DEFAULT 60,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Post templates
CREATE TABLE IF NOT EXISTS social.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    hashtags JSONB DEFAULT '[]',
    category VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_user ON social.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social.posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social.posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_social_inbox_account ON social.inbox(account_id);
CREATE INDEX IF NOT EXISTS idx_social_inbox_unread ON social.inbox(account_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_social_analytics_date ON social.analytics(account_id, date);
