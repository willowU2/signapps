//! User preferences repository for database operations.

use crate::models::user_preferences::{UserPreferences, UserPreferencesUpdate};
use chrono::Utc;
use signapps_common::Result;
use signapps_db_shared::DatabasePool;
use uuid::Uuid;

/// Repository for user preferences operations.
pub struct UserPreferencesRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> UserPreferencesRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Get preferences for a user (creates default if not exists).
    pub async fn get_or_create(&self, user_id: Uuid) -> Result<UserPreferences> {
        // Try to get existing preferences
        if let Some(prefs) = self.find_by_user_id(user_id).await? {
            return Ok(prefs);
        }

        // Create default preferences
        let prefs = sqlx::query_as::<_, UserPreferences>(
            r#"
            INSERT INTO identity.user_preferences (user_id)
            VALUES ($1)
            RETURNING *
            "#,
        )
        .bind(user_id)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(prefs)
    }

    /// Find preferences by user ID.
    pub async fn find_by_user_id(&self, user_id: Uuid) -> Result<Option<UserPreferences>> {
        let prefs = sqlx::query_as::<_, UserPreferences>(
            "SELECT * FROM identity.user_preferences WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(prefs)
    }

    /// Update preferences for a user.
    pub async fn update(
        &self,
        user_id: Uuid,
        update: &UserPreferencesUpdate,
        device_id: Option<&str>,
    ) -> Result<UserPreferences> {
        // Build dynamic update query
        let prefs = sqlx::query_as::<_, UserPreferences>(
            r#"
            INSERT INTO identity.user_preferences (user_id, theme, accent_color, font_size, compact_mode,
                language, timezone, date_format, time_format, first_day_of_week,
                notification_sound, notification_desktop, notification_email_digest,
                editor_autosave, editor_autosave_interval, editor_spell_check, editor_word_wrap,
                calendar_default_view, calendar_working_hours_start, calendar_working_hours_end, calendar_show_weekends,
                drive_default_view, drive_sort_by, drive_sort_order,
                keyboard_shortcuts_enabled, reduce_motion, high_contrast, extra, device_id, last_synced_at)
            VALUES ($1,
                COALESCE($2, 'system'), COALESCE($3, 'blue'), COALESCE($4, 'medium'), COALESCE($5, false),
                COALESCE($6, 'fr'), COALESCE($7, 'Europe/Paris'), COALESCE($8, 'dd/MM/yyyy'), COALESCE($9, '24h'), COALESCE($10, 1),
                COALESCE($11, true), COALESCE($12, true), COALESCE($13, 'daily'),
                COALESCE($14, true), COALESCE($15, 30), COALESCE($16, true), COALESCE($17, true),
                COALESCE($18, 'week'), COALESCE($19, '09:00'), COALESCE($20, '18:00'), COALESCE($21, true),
                COALESCE($22, 'grid'), COALESCE($23, 'name'), COALESCE($24, 'asc'),
                COALESCE($25, true), COALESCE($26, false), COALESCE($27, false), COALESCE($28, '{}'), $29, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                theme = COALESCE($2, identity.user_preferences.theme),
                accent_color = COALESCE($3, identity.user_preferences.accent_color),
                font_size = COALESCE($4, identity.user_preferences.font_size),
                compact_mode = COALESCE($5, identity.user_preferences.compact_mode),
                language = COALESCE($6, identity.user_preferences.language),
                timezone = COALESCE($7, identity.user_preferences.timezone),
                date_format = COALESCE($8, identity.user_preferences.date_format),
                time_format = COALESCE($9, identity.user_preferences.time_format),
                first_day_of_week = COALESCE($10, identity.user_preferences.first_day_of_week),
                notification_sound = COALESCE($11, identity.user_preferences.notification_sound),
                notification_desktop = COALESCE($12, identity.user_preferences.notification_desktop),
                notification_email_digest = COALESCE($13, identity.user_preferences.notification_email_digest),
                editor_autosave = COALESCE($14, identity.user_preferences.editor_autosave),
                editor_autosave_interval = COALESCE($15, identity.user_preferences.editor_autosave_interval),
                editor_spell_check = COALESCE($16, identity.user_preferences.editor_spell_check),
                editor_word_wrap = COALESCE($17, identity.user_preferences.editor_word_wrap),
                calendar_default_view = COALESCE($18, identity.user_preferences.calendar_default_view),
                calendar_working_hours_start = COALESCE($19, identity.user_preferences.calendar_working_hours_start),
                calendar_working_hours_end = COALESCE($20, identity.user_preferences.calendar_working_hours_end),
                calendar_show_weekends = COALESCE($21, identity.user_preferences.calendar_show_weekends),
                drive_default_view = COALESCE($22, identity.user_preferences.drive_default_view),
                drive_sort_by = COALESCE($23, identity.user_preferences.drive_sort_by),
                drive_sort_order = COALESCE($24, identity.user_preferences.drive_sort_order),
                keyboard_shortcuts_enabled = COALESCE($25, identity.user_preferences.keyboard_shortcuts_enabled),
                reduce_motion = COALESCE($26, identity.user_preferences.reduce_motion),
                high_contrast = COALESCE($27, identity.user_preferences.high_contrast),
                extra = COALESCE($28, identity.user_preferences.extra),
                device_id = $29,
                last_synced_at = NOW()
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(&update.theme)
        .bind(&update.accent_color)
        .bind(&update.font_size)
        .bind(update.compact_mode)
        .bind(&update.language)
        .bind(&update.timezone)
        .bind(&update.date_format)
        .bind(&update.time_format)
        .bind(update.first_day_of_week)
        .bind(update.notification_sound)
        .bind(update.notification_desktop)
        .bind(&update.notification_email_digest)
        .bind(update.editor_autosave)
        .bind(update.editor_autosave_interval)
        .bind(update.editor_spell_check)
        .bind(update.editor_word_wrap)
        .bind(&update.calendar_default_view)
        .bind(&update.calendar_working_hours_start)
        .bind(&update.calendar_working_hours_end)
        .bind(update.calendar_show_weekends)
        .bind(&update.drive_default_view)
        .bind(&update.drive_sort_by)
        .bind(&update.drive_sort_order)
        .bind(update.keyboard_shortcuts_enabled)
        .bind(update.reduce_motion)
        .bind(update.high_contrast)
        .bind(&update.extra)
        .bind(device_id)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(prefs)
    }

    /// Reset preferences to defaults.
    pub async fn reset(&self, user_id: Uuid) -> Result<UserPreferences> {
        // Delete existing and create new with defaults
        sqlx::query("DELETE FROM identity.user_preferences WHERE user_id = $1")
            .bind(user_id)
            .execute(self.pool.inner())
            .await?;

        self.get_or_create(user_id).await
    }

    /// Check if there's a conflict based on version.
    pub async fn check_conflict(
        &self,
        user_id: Uuid,
        client_timestamp: &str,
    ) -> Result<(bool, Option<UserPreferences>)> {
        let prefs = self.find_by_user_id(user_id).await?;

        if let Some(ref p) = prefs {
            // Parse client timestamp
            let client_time = chrono::DateTime::parse_from_rfc3339(client_timestamp)
                .map(|t| t.with_timezone(&Utc))
                .ok();

            // Check if server version is newer
            if let Some(client_t) = client_time {
                if p.updated_at > client_t {
                    return Ok((true, prefs));
                }
            }
        }

        Ok((false, prefs))
    }
}
