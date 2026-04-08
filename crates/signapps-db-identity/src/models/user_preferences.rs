//! User preferences model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// User preferences stored in the database.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserPreferences {
    pub id: Uuid,
    pub user_id: Uuid,
    pub version: i32,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub device_id: Option<String>,

    // Appearance
    pub theme: String,
    pub accent_color: Option<String>,
    pub font_size: Option<String>,
    pub compact_mode: bool,

    // Regional
    pub language: String,
    pub timezone: Option<String>,
    pub date_format: Option<String>,
    pub time_format: Option<String>,
    pub first_day_of_week: i16,

    // Notifications
    pub notification_sound: bool,
    pub notification_desktop: bool,
    pub notification_email_digest: Option<String>,

    // Editor
    pub editor_autosave: bool,
    pub editor_autosave_interval: i32,
    pub editor_spell_check: bool,
    pub editor_word_wrap: bool,

    // Calendar
    pub calendar_default_view: Option<String>,
    pub calendar_working_hours_start: Option<String>,
    pub calendar_working_hours_end: Option<String>,
    pub calendar_show_weekends: bool,

    // Drive
    pub drive_default_view: Option<String>,
    pub drive_sort_by: Option<String>,
    pub drive_sort_order: Option<String>,

    // Keyboard
    pub keyboard_shortcuts_enabled: bool,

    // Accessibility
    pub reduce_motion: bool,
    pub high_contrast: bool,

    // Extended
    pub extra: serde_json::Value,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Partial update payload for user preferences fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferencesUpdate {
    pub theme: Option<String>,
    pub accent_color: Option<String>,
    pub font_size: Option<String>,
    pub compact_mode: Option<bool>,
    pub language: Option<String>,
    pub timezone: Option<String>,
    pub date_format: Option<String>,
    pub time_format: Option<String>,
    pub first_day_of_week: Option<i16>,
    pub notification_sound: Option<bool>,
    pub notification_desktop: Option<bool>,
    pub notification_email_digest: Option<String>,
    pub editor_autosave: Option<bool>,
    pub editor_autosave_interval: Option<i32>,
    pub editor_spell_check: Option<bool>,
    pub editor_word_wrap: Option<bool>,
    pub calendar_default_view: Option<String>,
    pub calendar_working_hours_start: Option<String>,
    pub calendar_working_hours_end: Option<String>,
    pub calendar_show_weekends: Option<bool>,
    pub drive_default_view: Option<String>,
    pub drive_sort_by: Option<String>,
    pub drive_sort_order: Option<String>,
    pub keyboard_shortcuts_enabled: Option<bool>,
    pub reduce_motion: Option<bool>,
    pub high_contrast: Option<bool>,
    pub extra: Option<serde_json::Value>,
}

/// Client request to synchronise user preferences with the server.
#[derive(Debug, Clone, Deserialize)]
pub struct PreferencesSyncRequest {
    pub preferences: UserPreferencesUpdate,
    pub client_timestamp: String,
    pub device_id: String,
    #[serde(default)]
    pub force_overwrite: bool,
}

/// Response to a preferences sync request, returning the merged server state.
#[derive(Debug, Clone, Serialize)]
pub struct PreferencesSyncResponse {
    pub preferences: UserPreferences,
    pub server_timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflict_resolution: Option<String>,
}

/// Request to patch a specific section of user preferences.
#[derive(Debug, Clone, Deserialize)]
pub struct PreferencesPatchRequest {
    pub section: String,
    pub data: serde_json::Value,
    pub client_timestamp: String,
    pub device_id: String,
}

/// Details about a preferences sync conflict, including differing server and client versions.
#[derive(Debug, Clone, Serialize)]
pub struct ConflictInfo {
    pub has_conflict: bool,
    pub server_version: Option<UserPreferences>,
    pub client_version: Option<UserPreferences>,
    pub conflict_fields: Vec<String>,
}
