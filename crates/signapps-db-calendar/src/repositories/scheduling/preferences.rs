//! SchedulingPreferencesRepository — user scheduling preferences CRUD operations.

use crate::models::{SchedulingPreferences, UpdateSchedulingPreferences};
use signapps_db_shared::DatabasePool;
use signapps_common::Result;
use uuid::Uuid;

/// Repository for user scheduling preferences CRUD operations.
pub struct SchedulingPreferencesRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> SchedulingPreferencesRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Get preferences for a user.
    pub async fn get(&self, user_id: Uuid) -> Result<Option<SchedulingPreferences>> {
        let prefs = sqlx::query_as::<_, SchedulingPreferences>(
            "SELECT * FROM scheduling.user_preferences WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(prefs)
    }

    /// Get or create default preferences.
    pub async fn get_or_create(&self, user_id: Uuid) -> Result<SchedulingPreferences> {
        let prefs = sqlx::query_as::<_, SchedulingPreferences>(
            r#"
            INSERT INTO scheduling.user_preferences (user_id)
            VALUES ($1)
            ON CONFLICT (user_id) DO NOTHING
            RETURNING *
            "#,
        )
        .bind(user_id)
        .fetch_optional(self.pool.inner())
        .await?;

        // If INSERT returned nothing (conflict), fetch existing
        match prefs {
            Some(p) => Ok(p),
            None => {
                let existing = sqlx::query_as::<_, SchedulingPreferences>(
                    "SELECT * FROM scheduling.user_preferences WHERE user_id = $1",
                )
                .bind(user_id)
                .fetch_one(self.pool.inner())
                .await?;
                Ok(existing)
            },
        }
    }

    /// Update preferences.
    pub async fn update(
        &self,
        user_id: Uuid,
        prefs: UpdateSchedulingPreferences,
    ) -> Result<SchedulingPreferences> {
        let updated = sqlx::query_as::<_, SchedulingPreferences>(
            r#"
            UPDATE scheduling.user_preferences
            SET
                peak_hours_start = COALESCE($2, peak_hours_start),
                peak_hours_end = COALESCE($3, peak_hours_end),
                pomodoro_length = COALESCE($4, pomodoro_length),
                short_break_length = COALESCE($5, short_break_length),
                long_break_length = COALESCE($6, long_break_length),
                pomodoros_until_long_break = COALESCE($7, pomodoros_until_long_break),
                show_weekends = COALESCE($8, show_weekends),
                show_24_hour = COALESCE($9, show_24_hour),
                default_view = COALESCE($10, default_view),
                default_scope = COALESCE($11, default_scope),
                week_starts_on = COALESCE($12, week_starts_on),
                reminder_defaults = COALESCE($13, reminder_defaults),
                enable_sound_notifications = COALESCE($14, enable_sound_notifications),
                enable_desktop_notifications = COALESCE($15, enable_desktop_notifications),
                energy_profile = COALESCE($16, energy_profile),
                preferred_deep_work_time = COALESCE($17, preferred_deep_work_time),
                auto_schedule_enabled = COALESCE($18, auto_schedule_enabled),
                respect_blockers = COALESCE($19, respect_blockers),
                buffer_between_meetings = COALESCE($20, buffer_between_meetings),
                updated_at = NOW()
            WHERE user_id = $1
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(prefs.peak_hours_start)
        .bind(prefs.peak_hours_end)
        .bind(prefs.pomodoro_length)
        .bind(prefs.short_break_length)
        .bind(prefs.long_break_length)
        .bind(prefs.pomodoros_until_long_break)
        .bind(prefs.show_weekends)
        .bind(prefs.show_24_hour)
        .bind(&prefs.default_view)
        .bind(&prefs.default_scope)
        .bind(prefs.week_starts_on)
        .bind(&prefs.reminder_defaults)
        .bind(prefs.enable_sound_notifications)
        .bind(prefs.enable_desktop_notifications)
        .bind(&prefs.energy_profile)
        .bind(&prefs.preferred_deep_work_time)
        .bind(prefs.auto_schedule_enabled)
        .bind(prefs.respect_blockers)
        .bind(prefs.buffer_between_meetings)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }
}
