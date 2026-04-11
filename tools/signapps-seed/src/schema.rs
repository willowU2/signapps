//! schema.rs — applies critical missing DDL statements needed for the seed.
//!
//! This module executes only the CREATE TABLE / CREATE SCHEMA statements required
//! by the seed modules (chat, notifications, gamification, sharing).
//! Each statement uses IF NOT EXISTS so re-runs are idempotent.
//! Errors from individual statements are logged and skipped (object may
//! already exist with a different definition).

use tracing::info;

/// Apply the critical schema DDL required by the seed.
///
/// Executes `IF NOT EXISTS` DDL for every table the seed writes to.
/// Skips statements that fail (object already exists is OK).
///
/// # Errors
///
/// Never returns an error — individual DDL failures are logged as warnings.
///
/// # Panics
///
/// No panics.
pub async fn ensure_schema(pool: &sqlx::PgPool) {
    info!("ensuring critical schema DDL is applied");

    let statements: &[&str] = &[
        // ── chat schema ──────────────────────────────────────────────────
        "CREATE SCHEMA IF NOT EXISTS chat",
        r#"CREATE TABLE IF NOT EXISTS chat.channels (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            topic TEXT,
            is_private BOOLEAN NOT NULL DEFAULT false,
            created_by UUID NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )"#,
        // Add missing columns to chat.messages if the table exists with old schema
        "ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES chat.channels(id) ON DELETE CASCADE",
        "ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS user_id UUID",
        "ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS parent_id UUID",
        "ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '{}'",
        "ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS attachment JSONB",
        "ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false",
        "ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        "ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        r#"CREATE TABLE IF NOT EXISTS chat.messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            channel_id UUID NOT NULL REFERENCES chat.channels(id) ON DELETE CASCADE,
            user_id UUID NOT NULL,
            username TEXT NOT NULL,
            content TEXT NOT NULL,
            parent_id UUID REFERENCES chat.messages(id) ON DELETE SET NULL,
            reactions JSONB NOT NULL DEFAULT '{}',
            attachment JSONB,
            is_pinned BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )"#,
        // ── notifications schema ─────────────────────────────────────────
        "CREATE SCHEMA IF NOT EXISTS notifications",
        r#"CREATE TABLE IF NOT EXISTS notifications.items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            "type" TEXT NOT NULL DEFAULT 'system',
            title TEXT NOT NULL DEFAULT '',
            body TEXT,
            module TEXT NOT NULL DEFAULT 'system',
            entity_type TEXT,
            entity_id UUID,
            deep_link TEXT,
            read BOOLEAN NOT NULL DEFAULT false,
            read_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )"#,
        // Add missing columns to notifications.items if it exists with old schema.
        // NOTE: the deleted-migration DB version uses notification_type (NOT NULL).
        // The newer schema uses "type" (quoted). We add both so both code paths work.
        "ALTER TABLE notifications.items ADD COLUMN IF NOT EXISTS notification_type TEXT NOT NULL DEFAULT 'system'",
        r#"ALTER TABLE notifications.items ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'system'"#,
        "ALTER TABLE notifications.items ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE notifications.items ADD COLUMN IF NOT EXISTS body TEXT",
        "ALTER TABLE notifications.items ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'system'",
        "ALTER TABLE notifications.items ADD COLUMN IF NOT EXISTS entity_type TEXT",
        "ALTER TABLE notifications.items ADD COLUMN IF NOT EXISTS entity_id UUID",
        "ALTER TABLE notifications.items ADD COLUMN IF NOT EXISTS deep_link TEXT",
        "ALTER TABLE notifications.items ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT false",
        "ALTER TABLE notifications.items ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ",
        r#"CREATE TABLE IF NOT EXISTS notifications.preferences (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL UNIQUE,
            channels JSONB NOT NULL DEFAULT '{"in_app": true, "email": true, "push": false}',
            quiet_hours_start TIME,
            quiet_hours_end TIME,
            digest_frequency TEXT,
            muted_modules TEXT[] DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )"#,
        // Add missing columns to notifications.preferences if old schema
        "ALTER TABLE notifications.preferences ADD COLUMN IF NOT EXISTS channels JSONB NOT NULL DEFAULT '{\"in_app\": true, \"email\": true, \"push\": false}'",
        "ALTER TABLE notifications.preferences ADD COLUMN IF NOT EXISTS quiet_hours_start TIME",
        "ALTER TABLE notifications.preferences ADD COLUMN IF NOT EXISTS quiet_hours_end TIME",
        "ALTER TABLE notifications.preferences ADD COLUMN IF NOT EXISTS digest_frequency TEXT",
        "ALTER TABLE notifications.preferences ADD COLUMN IF NOT EXISTS muted_modules TEXT[] DEFAULT '{}'",
        "ALTER TABLE notifications.preferences ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        "ALTER TABLE notifications.preferences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        // ── gamification schema ──────────────────────────────────────────
        "CREATE SCHEMA IF NOT EXISTS gamification",
        r#"CREATE TABLE IF NOT EXISTS gamification.user_xp (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL UNIQUE,
            total_xp BIGINT NOT NULL DEFAULT 0,
            level INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )"#,
        r#"CREATE TABLE IF NOT EXISTS gamification.xp_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            event_type TEXT NOT NULL,
            xp_awarded INTEGER NOT NULL DEFAULT 0,
            module TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )"#,
        r#"CREATE TABLE IF NOT EXISTS gamification.badges (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            badge_type TEXT NOT NULL,
            badge_name TEXT NOT NULL,
            awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (user_id, badge_type)
        )"#,
        // ── sharing schema ───────────────────────────────────────────────
        "CREATE SCHEMA IF NOT EXISTS sharing",
        r#"CREATE TABLE IF NOT EXISTS sharing.policies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )"#,
        r#"CREATE TABLE IF NOT EXISTS sharing.grants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            resource_type TEXT NOT NULL,
            resource_id UUID NOT NULL,
            grantee_id UUID NOT NULL,
            granted_by UUID NOT NULL,
            permission TEXT NOT NULL DEFAULT 'read',
            expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )"#,
    ];

    for stmt in statements {
        match sqlx::query(stmt).execute(pool).await {
            Ok(_) => tracing::debug!("DDL applied: {}", &stmt[..stmt.len().min(60)]),
            Err(e) => tracing::warn!(
                error = %e,
                stmt = &stmt[..stmt.len().min(60)],
                "DDL skipped (object may already exist in different form)"
            ),
        }
    }

    info!("schema DDL pass complete");
}
