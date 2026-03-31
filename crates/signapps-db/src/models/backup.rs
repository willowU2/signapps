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

// ============================================================
// Drive SP3 Backup Models (storage schema)
// ============================================================

/// Drive backup plan entity.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct BackupPlan {
    pub id: Uuid,
    pub name: String,
    pub schedule: String,
    pub backup_type: String,
    pub retention_days: i32,
    pub max_snapshots: i32,
    pub include_paths: Vec<String>,
    pub exclude_paths: Vec<String>,
    pub enabled: bool,
    pub last_run_at: Option<DateTime<Utc>>,
    pub next_run_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a backup plan.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateBackupPlan {
    pub name: String,
    #[serde(default = "default_schedule")]
    pub schedule: String,
    #[serde(default = "default_backup_type")]
    pub backup_type: String,
    #[serde(default = "default_retention_days")]
    pub retention_days: i32,
    #[serde(default = "default_max_snapshots")]
    pub max_snapshots: i32,
    #[serde(default)]
    pub include_paths: Vec<String>,
    #[serde(default)]
    pub exclude_paths: Vec<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_schedule() -> String { "0 2 * * *".to_string() }
fn default_backup_type() -> String { "incremental".to_string() }
fn default_retention_days() -> i32 { 30 }
fn default_max_snapshots() -> i32 { 10 }
fn default_true() -> bool { true }

/// Request to update a backup plan.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateBackupPlan {
    pub name: Option<String>,
    pub schedule: Option<String>,
    pub backup_type: Option<String>,
    pub retention_days: Option<i32>,
    pub max_snapshots: Option<i32>,
    pub include_paths: Option<Vec<String>>,
    pub exclude_paths: Option<Vec<String>>,
    pub enabled: Option<bool>,
}

/// Drive backup snapshot entity.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct BackupSnapshot {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub backup_type: String,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub files_count: i32,
    pub total_size: i64,
    pub storage_path: Option<String>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Drive backup entry (one file per entry).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct BackupEntry {
    pub id: Uuid,
    pub snapshot_id: Uuid,
    pub node_id: Option<Uuid>,
    pub node_path: String,
    pub file_hash: Option<String>,
    pub file_size: i64,
    pub backup_key: String,
    pub created_at: DateTime<Utc>,
}

/// Request body for restore operation.
#[derive(Debug, Clone, Deserialize)]
pub struct RestoreRequest {
    pub snapshot_id: Uuid,
    pub node_path: Option<String>,
    pub target_path: Option<String>,
}
