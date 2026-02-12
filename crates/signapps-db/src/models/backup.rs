//! Backup profile and run models.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Backup profile entity.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct BackupProfile {
    pub id: Uuid,
    pub name: String,
    pub container_ids: Vec<Uuid>,
    pub schedule: Option<String>,
    pub destination_type: String,
    pub destination_config: serde_json::Value,
    pub retention_policy: Option<serde_json::Value>,
    pub password_encrypted: String,
    pub enabled: bool,
    pub last_run_at: Option<DateTime<Utc>>,
    pub owner_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create backup profile request.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateBackupProfile {
    pub name: String,
    pub container_ids: Vec<Uuid>,
    pub schedule: Option<String>,
    pub destination_type: String,
    pub destination_config: serde_json::Value,
    pub retention_policy: Option<serde_json::Value>,
    pub password: String,
}

/// Update backup profile request.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateBackupProfile {
    pub name: Option<String>,
    pub container_ids: Option<Vec<Uuid>>,
    pub schedule: Option<String>,
    pub destination_type: Option<String>,
    pub destination_config: Option<serde_json::Value>,
    pub retention_policy: Option<serde_json::Value>,
    pub enabled: Option<bool>,
}

/// Backup run entity.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct BackupRun {
    pub id: Uuid,
    pub profile_id: Uuid,
    pub status: String,
    pub snapshot_id: Option<String>,
    pub size_bytes: Option<i64>,
    pub files_new: Option<i32>,
    pub files_changed: Option<i32>,
    pub duration_seconds: Option<i32>,
    pub error_message: Option<String>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// Retention policy configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionPolicy {
    #[serde(default)]
    pub keep_last: Option<i32>,
    #[serde(default)]
    pub keep_daily: Option<i32>,
    #[serde(default)]
    pub keep_weekly: Option<i32>,
    #[serde(default)]
    pub keep_monthly: Option<i32>,
}
