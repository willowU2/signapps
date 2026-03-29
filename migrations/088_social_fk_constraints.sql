-- Migration 088: Add missing FK constraints on social tables
-- Adds FK constraints on user_id / owner_id columns that reference
-- identity.users(id) ON DELETE CASCADE.
-- Uses DO $$ blocks with exception handling for idempotency (PostgreSQL
-- does not support ADD CONSTRAINT IF NOT EXISTS for named constraints).

-- social.accounts.user_id
DO $$
BEGIN
    ALTER TABLE social.accounts
        ADD CONSTRAINT fk_social_accounts_user
        FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social.posts.user_id
DO $$
BEGIN
    ALTER TABLE social.posts
        ADD CONSTRAINT fk_social_posts_user
        FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social.rss_feeds.user_id
DO $$
BEGIN
    ALTER TABLE social.rss_feeds
        ADD CONSTRAINT fk_social_rss_feeds_user
        FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social.templates.user_id
DO $$
BEGIN
    ALTER TABLE social.templates
        ADD CONSTRAINT fk_social_templates_user
        FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social.signatures.user_id  (added in migration 063)
DO $$
BEGIN
    ALTER TABLE social.signatures
        ADD CONSTRAINT fk_social_signatures_user
        FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social.media.user_id  (added in migration 063)
DO $$
BEGIN
    ALTER TABLE social.media
        ADD CONSTRAINT fk_social_media_user
        FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social.short_urls.user_id  (added in migration 063)
DO $$
BEGIN
    ALTER TABLE social.short_urls
        ADD CONSTRAINT fk_social_short_urls_user
        FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social.webhooks.user_id  (added in migration 063)
DO $$
BEGIN
    ALTER TABLE social.webhooks
        ADD CONSTRAINT fk_social_webhooks_user
        FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social.workspaces.owner_id  (added in migration 063)
DO $$
BEGIN
    ALTER TABLE social.workspaces
        ADD CONSTRAINT fk_social_workspaces_owner
        FOREIGN KEY (owner_id) REFERENCES identity.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social.workspace_members.user_id  (added in migration 063)
DO $$
BEGIN
    ALTER TABLE social.workspace_members
        ADD CONSTRAINT fk_social_workspace_members_user
        FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social.time_slots.user_id  (added in migration 063)
DO $$
BEGIN
    ALTER TABLE social.time_slots
        ADD CONSTRAINT fk_social_time_slots_user
        FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social.content_sets.user_id  (added in migration 063)
DO $$
BEGIN
    ALTER TABLE social.content_sets
        ADD CONSTRAINT fk_social_content_sets_user
        FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social.api_keys.user_id  (added in migration 063)
DO $$
BEGIN
    ALTER TABLE social.api_keys
        ADD CONSTRAINT fk_social_api_keys_user
        FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
