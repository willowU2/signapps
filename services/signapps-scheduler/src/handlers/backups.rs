//! Backup management handlers (V3-05 - Automatic Backup System).
//!
//! API skeleton for backup management. Actual pg_dump execution requires FIXME(backups) items below.
//! All state is held in-memory via `Arc<Mutex<BackupStore>>`.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

use signapps_common::Result;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BackupType {
    Full,
    Incremental,
    DatabaseOnly,
    StorageOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BackupStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupJob {
    pub id: Uuid,
    pub backup_type: BackupType,
    pub status: BackupStatus,
    pub size_bytes: Option<i64>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupConfig {
    pub enabled: bool,
    pub schedule_cron: String,
    pub retention_daily: u32,
    pub retention_weekly: u32,
    pub retention_monthly: u32,
    pub backup_path: String,
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            schedule_cron: "0 2 * * *".to_string(), // daily at 02:00
            retention_daily: 7,
            retention_weekly: 4,
            retention_monthly: 12,
            backup_path: "/var/backups/signapps".to_string(),
        }
    }
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

#[derive(Debug, Default)]
pub struct BackupStore {
    pub jobs: HashMap<Uuid, BackupJob>,
    pub config: BackupConfig,
}

pub type SharedBackupStore = Arc<Mutex<BackupStore>>;

pub fn new_backup_store() -> SharedBackupStore {
    Arc::new(Mutex::new(BackupStore::default()))
}

// ---------------------------------------------------------------------------
// Request / response helpers
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct TriggerBackupRequest {
    pub backup_type: Option<BackupType>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /api/v1/admin/backups — list backup history (most recent first).
pub async fn list_backups(
    State(store): State<SharedBackupStore>,
) -> Result<Json<Vec<BackupJob>>> {
    let store = store.lock().expect("backup store lock poisoned");
    let mut jobs: Vec<BackupJob> = store.jobs.values().cloned().collect();
    jobs.sort_by(|a, b| b.started_at.cmp(&a.started_at));
    Ok(Json(jobs))
}

/// POST /api/v1/admin/backups — trigger a manual backup.
///
/// FIXME(backups): Implement pg_dump spawn + S3/local storage upload
pub async fn trigger_backup(
    State(store): State<SharedBackupStore>,
    Json(req): Json<TriggerBackupRequest>,
) -> Result<(StatusCode, Json<BackupJob>)> {
    let backup_type = req.backup_type.unwrap_or(BackupType::Full);
    let job = BackupJob {
        id: Uuid::new_v4(),
        backup_type,
        status: BackupStatus::Pending,
        size_bytes: None,
        started_at: Utc::now(),
        completed_at: None,
        path: None,
    };
    let mut store = store.lock().expect("backup store lock poisoned");
    store.jobs.insert(job.id, job.clone());
    // FIXME(backups): spawn pg_dump/rsync child process here
    Ok((StatusCode::CREATED, Json(job)))
}

/// GET /api/v1/admin/backups/:id — get backup details.
pub async fn get_backup(
    State(store): State<SharedBackupStore>,
    Path(id): Path<Uuid>,
) -> Result<Json<BackupJob>> {
    let store = store.lock().expect("backup store lock poisoned");
    let job = store
        .jobs
        .get(&id)
        .cloned()
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Backup {}", id)))?;
    Ok(Json(job))
}

/// DELETE /api/v1/admin/backups/:id — delete a backup record.
///
/// FIXME(backups): Delete backup file at job.path after DB removal
pub async fn delete_backup(
    State(store): State<SharedBackupStore>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let mut store = store.lock().expect("backup store lock poisoned");
    if store.jobs.remove(&id).is_none() {
        return Err(signapps_common::Error::NotFound(format!("Backup {}", id)));
    }
    // FIXME(backups): fs::remove_file(job.path) after successful DB delete
    Ok(StatusCode::NO_CONTENT)
}

/// PUT /api/v1/admin/backups/config — update backup schedule configuration.
pub async fn update_backup_config(
    State(store): State<SharedBackupStore>,
    Json(config): Json<BackupConfig>,
) -> Result<Json<BackupConfig>> {
    let mut store = store.lock().expect("backup store lock poisoned");
    store.config = config.clone();
    // FIXME(backups): Re-register cron job with scheduler after config update
    Ok(Json(config))
}

/// GET /api/v1/admin/backups/config — retrieve current backup configuration.
pub async fn get_backup_config(
    State(store): State<SharedBackupStore>,
) -> Result<Json<BackupConfig>> {
    let store = store.lock().expect("backup store lock poisoned");
    Ok(Json(store.config.clone()))
}
