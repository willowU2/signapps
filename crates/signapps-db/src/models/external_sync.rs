//! External Calendar Sync models
//!
//! Models for OAuth connections to Google, Microsoft, Apple, CalDAV providers
//! and synchronization configuration.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// Provider Connection (OAuth tokens)
// ============================================================================

/// An external calendar provider supported for OAuth synchronisation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum CalendarProvider {
    Google,
    Microsoft,
    Apple,
    Caldav,
}

impl std::fmt::Display for CalendarProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CalendarProvider::Google => write!(f, "google"),
            CalendarProvider::Microsoft => write!(f, "microsoft"),
            CalendarProvider::Apple => write!(f, "apple"),
            CalendarProvider::Caldav => write!(f, "caldav"),
        }
    }
}

impl std::str::FromStr for CalendarProvider {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "google" => Ok(CalendarProvider::Google),
            "microsoft" => Ok(CalendarProvider::Microsoft),
            "apple" => Ok(CalendarProvider::Apple),
            "caldav" => Ok(CalendarProvider::Caldav),
            _ => Err(format!("Unknown provider: {}", s)),
        }
    }
}

/// The current synchronisation state of a provider connection.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum SyncStatus {
    Idle,
    Syncing,
    Error,
    Paused,
}

/// An OAuth connection to an external calendar provider storing tokens and sync state.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ProviderConnection {
    pub id: Uuid,
    pub user_id: Uuid,
    pub provider: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub token_expires_at: Option<DateTime<Utc>>,
    pub account_email: Option<String>,
    pub account_name: Option<String>,
    pub is_connected: bool,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub sync_status: String,
    pub sync_error: Option<String>,
    pub caldav_url: Option<String>,
    pub caldav_username: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a new provider OAuth connection.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateProviderConnection {
    pub provider: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub token_expires_at: Option<DateTime<Utc>>,
    pub account_email: Option<String>,
    pub account_name: Option<String>,
    pub caldav_url: Option<String>,
    pub caldav_username: Option<String>,
}

/// Request to update tokens or sync state for an existing provider connection.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateProviderConnection {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub token_expires_at: Option<DateTime<Utc>>,
    pub is_connected: Option<bool>,
    pub sync_status: Option<String>,
    pub sync_error: Option<String>,
    pub last_sync_at: Option<DateTime<Utc>>,
}

// ============================================================================
// External Calendar (discovered from provider)
// ============================================================================

/// A calendar discovered from an external provider and associated with a connection.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ExternalCalendar {
    pub id: Uuid,
    pub connection_id: Uuid,
    pub external_id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub timezone: Option<String>,
    pub is_primary: bool,
    pub is_readonly: bool,
    pub sync_enabled: bool,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub sync_token: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to register a discovered external calendar.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateExternalCalendar {
    pub external_id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub timezone: Option<String>,
    pub is_primary: Option<bool>,
    pub is_readonly: Option<bool>,
}

/// Request to update an external calendar's settings or sync token.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateExternalCalendar {
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
    pub sync_enabled: Option<bool>,
    pub sync_token: Option<String>,
    pub last_sync_at: Option<DateTime<Utc>>,
}

// ============================================================================
// Sync Configuration
// ============================================================================

/// The direction in which calendar events are synchronised between local and external.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SyncDirection {
    ImportOnly,
    ExportOnly,
    Bidirectional,
}

/// Strategy for resolving sync conflicts between a local and external event.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ConflictResolution {
    LocalWins,
    RemoteWins,
    Newest,
    Ask,
}

/// Configuration linking a local calendar to an external calendar for automatic sync.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct SyncConfig {
    pub id: Uuid,
    pub user_id: Uuid,
    pub local_calendar_id: Uuid,
    pub external_calendar_id: Uuid,
    pub sync_direction: String,
    pub conflict_resolution: String,
    pub sync_events: bool,
    pub sync_reminders: bool,
    pub sync_attendees: bool,
    pub sync_past_events: bool,
    pub past_events_days: Option<i32>,
    pub auto_sync_enabled: bool,
    pub auto_sync_interval_minutes: i32,
    pub last_auto_sync_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a sync configuration between a local and external calendar.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateSyncConfig {
    pub local_calendar_id: Uuid,
    pub external_calendar_id: Uuid,
    pub sync_direction: Option<String>,
    pub conflict_resolution: Option<String>,
    pub sync_events: Option<bool>,
    pub sync_reminders: Option<bool>,
    pub sync_attendees: Option<bool>,
    pub sync_past_events: Option<bool>,
    pub past_events_days: Option<i32>,
    pub auto_sync_enabled: Option<bool>,
    pub auto_sync_interval_minutes: Option<i32>,
}

/// Request to update an existing sync configuration.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateSyncConfig {
    pub sync_direction: Option<String>,
    pub conflict_resolution: Option<String>,
    pub sync_events: Option<bool>,
    pub sync_reminders: Option<bool>,
    pub sync_attendees: Option<bool>,
    pub sync_past_events: Option<bool>,
    pub past_events_days: Option<i32>,
    pub auto_sync_enabled: Option<bool>,
    pub auto_sync_interval_minutes: Option<i32>,
    pub is_active: Option<bool>,
}

// ============================================================================
// Sync Log (history)
// ============================================================================

/// A historical record of a single sync run for a given sync configuration.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct SyncLog {
    pub id: Uuid,
    pub sync_config_id: Uuid,
    pub direction: String,
    pub status: String,
    pub events_imported: i32,
    pub events_exported: i32,
    pub events_updated: i32,
    pub events_deleted: i32,
    pub conflicts_detected: i32,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub duration_ms: Option<i32>,
    pub error_message: Option<String>,
    pub error_details: Option<serde_json::Value>,
}

/// Request to persist a sync log entry after a sync run.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateSyncLog {
    pub direction: String,
    pub status: String,
    pub events_imported: Option<i32>,
    pub events_exported: Option<i32>,
    pub events_updated: Option<i32>,
    pub events_deleted: Option<i32>,
    pub conflicts_detected: Option<i32>,
    pub error_message: Option<String>,
    pub error_details: Option<serde_json::Value>,
}

// ============================================================================
// Sync Conflict
// ============================================================================

/// A detected conflict between a local event and its external counterpart during sync.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct SyncConflict {
    pub id: Uuid,
    pub sync_config_id: Uuid,
    pub local_event_id: Option<Uuid>,
    pub external_event_id: Option<String>,
    pub conflict_type: String,
    pub local_data: Option<serde_json::Value>,
    pub remote_data: Option<serde_json::Value>,
    pub local_updated_at: Option<DateTime<Utc>>,
    pub external_updated_at: Option<DateTime<Utc>>,
    pub resolved: bool,
    pub resolution: Option<String>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// Request to record a new sync conflict.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateSyncConflict {
    pub local_event_id: Option<Uuid>,
    pub external_event_id: Option<String>,
    pub conflict_type: String,
    pub local_data: Option<serde_json::Value>,
    pub remote_data: Option<serde_json::Value>,
    pub local_updated_at: Option<DateTime<Utc>>,
    pub external_updated_at: Option<DateTime<Utc>>,
}

/// Request to mark a sync conflict as resolved with a chosen resolution strategy.
#[derive(Debug, Clone, Deserialize)]
pub struct ResolveConflict {
    pub resolution: String, // local, remote, merged, skipped
}

// ============================================================================
// Event Mapping
// ============================================================================

/// A mapping between a local event ID and its corresponding external event ID for sync tracking.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct EventMapping {
    pub id: Uuid,
    pub sync_config_id: Uuid,
    pub local_event_id: Uuid,
    pub external_event_id: String,
    pub local_etag: Option<String>,
    pub external_etag: Option<String>,
    pub last_synced_at: DateTime<Utc>,
    pub local_checksum: Option<String>,
    pub external_checksum: Option<String>,
}

/// Request to create a new local-to-external event mapping.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateEventMapping {
    pub local_event_id: Uuid,
    pub external_event_id: String,
    pub local_etag: Option<String>,
    pub external_etag: Option<String>,
    pub local_checksum: Option<String>,
    pub external_checksum: Option<String>,
}

// ============================================================================
// OAuth State (CSRF protection)
// ============================================================================

/// A short-lived OAuth state token used for CSRF protection during the OAuth flow.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct OAuthState {
    pub id: Uuid,
    pub user_id: Uuid,
    pub state: String,
    pub provider: String,
    pub redirect_uri: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Request to persist a new OAuth state token before redirecting the user.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateOAuthState {
    pub state: String,
    pub provider: String,
    pub redirect_uri: String,
}

// ============================================================================
// API Response types
// ============================================================================

/// API response for a provider connection, omitting sensitive token fields.
#[derive(Debug, Clone, Serialize)]
pub struct ProviderConnectionResponse {
    pub id: Uuid,
    pub provider: String,
    pub account_email: Option<String>,
    pub account_name: Option<String>,
    pub is_connected: bool,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub sync_status: String,
    pub sync_error: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<ProviderConnection> for ProviderConnectionResponse {
    fn from(conn: ProviderConnection) -> Self {
        Self {
            id: conn.id,
            provider: conn.provider,
            account_email: conn.account_email,
            account_name: conn.account_name,
            is_connected: conn.is_connected,
            last_sync_at: conn.last_sync_at,
            sync_status: conn.sync_status,
            sync_error: conn.sync_error,
            created_at: conn.created_at,
        }
    }
}

/// Response containing an OAuth authorisation URL and its associated state token.
#[derive(Debug, Clone, Serialize)]
pub struct OAuthUrlResponse {
    pub url: String,
    pub state: String,
}

/// Callback payload received from the external OAuth provider after user authorisation.
#[derive(Debug, Clone, Deserialize)]
pub struct OAuthCallbackRequest {
    pub code: String,
    pub state: String,
}
