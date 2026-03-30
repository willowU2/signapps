//! PostgreSQL backup handlers.
//!
//! Provides admin-only endpoints to trigger `pg_dump` backups and list existing
//! backup files.  Backups are written to `data/backups/` relative to the current
//! working directory.
//!
//! Routes (admin-only):
//! - `POST /api/v1/admin/backup`    — run pg_dump, return file metadata
//! - `GET  /api/v1/admin/backups`   — list existing backup files

use axum::{extract::State, Json};
use chrono::Utc;
use serde::Serialize;
use signapps_common::{Error, Result};

use crate::AppState;

// =============================================================================
// Response types
// =============================================================================

/// Metadata returned after a successful backup.
#[derive(Debug, Serialize)]
pub struct BackupCreated {
    pub filename: String,
    pub size_bytes: u64,
    pub created_at: String,
}

/// One entry in the backup listing.
#[derive(Debug, Serialize)]
pub struct BackupEntry {
    pub filename: String,
    pub size_bytes: u64,
    pub created_at: String,
}

// =============================================================================
// Helpers
// =============================================================================

/// Return the backup directory path, creating it if it does not exist.
fn backup_dir() -> std::path::PathBuf {
    let dir = std::path::PathBuf::from("data/backups");
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    dir
}

// =============================================================================
// Handlers
// =============================================================================

/// POST /api/v1/admin/backup
///
/// Executes `pg_dump` and writes the output to a timestamped file in
/// `data/backups/`.  Returns file name, size, and creation time.
/// Requires admin role (enforced by the router middleware).
#[tracing::instrument(skip_all)]
pub async fn create_backup(State(state): State<AppState>) -> Result<Json<BackupCreated>> {
    let database_url = signapps_common::bootstrap::env_or(
        "DATABASE_URL",
        "postgres://signapps:password@localhost:5432/signapps",
    );

    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let filename = format!("backup_{}.sql", timestamp);
    let dir = backup_dir();
    let path = dir.join(&filename);

    tracing::info!(filename = %filename, "Starting pg_dump backup");

    let output = std::process::Command::new("pg_dump")
        .arg("--no-password")
        .arg("--format=plain")
        .arg("--file")
        .arg(&path)
        .arg(&database_url)
        .output()
        .map_err(|e| {
            tracing::error!("Failed to spawn pg_dump: {:?}", e);
            Error::Internal(format!("pg_dump not available: {}", e))
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        tracing::error!(stderr = %stderr, "pg_dump exited with error");
        return Err(Error::Internal(format!("pg_dump failed: {}", stderr)));
    }

    let size_bytes = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

    let created_at = Utc::now().to_rfc3339();
    tracing::info!(filename = %filename, size_bytes, "Backup completed");

    // Suppress unused-state warning — state is available if we need DB ops later
    let _ = &state;

    Ok(Json(BackupCreated {
        filename,
        size_bytes,
        created_at,
    }))
}

/// GET /api/v1/admin/backups
///
/// Lists all `.sql` backup files in `data/backups/`, sorted newest first.
/// Requires admin role (enforced by the router middleware).
#[tracing::instrument(skip_all)]
pub async fn list_backups(State(_state): State<AppState>) -> Result<Json<Vec<BackupEntry>>> {
    let dir = backup_dir();

    let mut entries: Vec<BackupEntry> = std::fs::read_dir(&dir)
        .map_err(|e| Error::Internal(format!("Cannot read backup directory: {}", e)))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".sql") {
                return None;
            }
            let meta = entry.metadata().ok()?;
            let size_bytes = meta.len();
            let modified = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| {
                    let secs = d.as_secs() as i64;
                    chrono::DateTime::from_timestamp(secs, 0)
                        .unwrap_or_else(Utc::now)
                        .to_rfc3339()
                })
                .unwrap_or_else(|| Utc::now().to_rfc3339());

            Some(BackupEntry {
                filename: name,
                size_bytes,
                created_at: modified,
            })
        })
        .collect();

    // Sort newest first (lexicographic on rfc3339 timestamps works correctly)
    entries.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(Json(entries))
}
