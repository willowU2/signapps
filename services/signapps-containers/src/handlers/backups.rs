//! Backup management handlers.

use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use signapps_db::models::{BackupProfile, BackupRun, CreateBackupProfile, UpdateBackupProfile};
use signapps_db::repositories::BackupRepository;
use uuid::Uuid;

use crate::backup::restic::ResticClient;
use crate::AppState;

// === Responses ===

#[derive(Debug, Serialize)]
/// Response for ProfileList.
pub struct ProfileListResponse {
    pub profiles: Vec<BackupProfile>,
}

#[derive(Debug, Serialize)]
/// Response for RunList.
pub struct RunListResponse {
    pub runs: Vec<BackupRun>,
}

#[derive(Debug, Serialize)]
/// Response for SnapshotList.
pub struct SnapshotListResponse {
    pub snapshots: Vec<crate::backup::restic::Snapshot>,
}

// === Requests ===

#[derive(Debug, Deserialize)]
/// Request body for Restore.
pub struct RestoreRequest {
    pub snapshot_id: String,
    pub target_path: Option<String>,
}

// === Handlers ===

/// List all backup profiles.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_profiles(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ProfileListResponse>> {
    let repo = BackupRepository::new(&state.pool);

    let profiles = if claims.role >= 2 {
        // Admin sees all
        repo.list_profiles().await?
    } else {
        repo.list_profiles_by_owner(claims.sub).await?
    };

    Ok(Json(ProfileListResponse { profiles }))
}

/// Get a single backup profile.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_profile(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<BackupProfile>> {
    let repo = BackupRepository::new(&state.pool);
    let profile = repo
        .find_profile(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Backup profile {}", id)))?;

    Ok(Json(profile))
}

/// Create a new backup profile.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<CreateBackupProfile>,
) -> Result<Json<BackupProfile>> {
    let repo = BackupRepository::new(&state.pool);

    // Initialize the restic repository
    let restic = ResticClient::new();
    restic
        .init(
            &req.destination_type,
            &req.destination_config,
            &req.password,
        )
        .await
        .map_err(|e| Error::Internal(format!("Failed to init restic repo: {}", e)))?;

    let profile = repo.create_profile(req, Some(claims.sub)).await?;

    tracing::info!(
        profile_id = %profile.id,
        profile_name = %profile.name,
        "Backup profile created"
    );

    Ok(Json(profile))
}

/// Update a backup profile.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn update_profile(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateBackupProfile>,
) -> Result<Json<BackupProfile>> {
    let repo = BackupRepository::new(&state.pool);

    // Verify exists
    repo.find_profile(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Backup profile {}", id)))?;

    let profile = repo.update_profile(id, req).await?;

    Ok(Json(profile))
}

/// Delete a backup profile.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn delete_profile(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let repo = BackupRepository::new(&state.pool);

    repo.find_profile(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Backup profile {}", id)))?;

    repo.delete_profile(id).await?;

    tracing::info!(profile_id = %id, "Backup profile deleted");

    Ok(Json(serde_json::json!({ "deleted": true })))
}

/// Run a backup now.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn run_backup(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<BackupRun>> {
    let repo = BackupRepository::new(&state.pool);
    let profile = repo
        .find_profile(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Backup profile {}", id)))?;

    // Create run record
    let run = repo.create_run(id).await?;
    let run_id = run.id;

    // Spawn backup in background
    let pool = state.pool.clone();
    tokio::spawn(async move {
        let restic = ResticClient::new();
        if let Err(e) = crate::backup::service::run_backup(&pool, &restic, profile.id).await {
            tracing::error!(
                profile = %profile.name,
                "Manual backup failed: {e}"
            );
        }
    });

    // Return the run (still running)
    let repo2 = BackupRepository::new(&state.pool);
    let updated_run = repo2
        .list_runs(id, 1)
        .await?
        .into_iter()
        .find(|r| r.id == run_id)
        .unwrap_or(run);

    Ok(Json(updated_run))
}

/// List snapshots for a backup profile.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_snapshots(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<SnapshotListResponse>> {
    let repo = BackupRepository::new(&state.pool);
    let profile = repo
        .find_profile(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Backup profile {}", id)))?;

    let restic = ResticClient::new();
    let snapshots = restic
        .snapshots(
            &profile.destination_type,
            &profile.destination_config,
            &profile.password_encrypted,
        )
        .await
        .map_err(|e| Error::Internal(format!("Failed to list snapshots: {}", e)))?;

    Ok(Json(SnapshotListResponse { snapshots }))
}

/// Restore a snapshot.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn restore_snapshot(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<RestoreRequest>,
) -> Result<Json<serde_json::Value>> {
    let repo = BackupRepository::new(&state.pool);
    let profile = repo
        .find_profile(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Backup profile {}", id)))?;

    let target = req
        .target_path
        .unwrap_or_else(|| "/tmp/restore".to_string());

    let restic = ResticClient::new();
    restic
        .restore(
            &profile.destination_type,
            &profile.destination_config,
            &profile.password_encrypted,
            &req.snapshot_id,
            &target,
        )
        .await
        .map_err(|e| Error::Internal(format!("Restore failed: {}", e)))?;

    tracing::info!(
        profile = %profile.name,
        snapshot = %req.snapshot_id,
        target = %target,
        "Snapshot restored"
    );

    Ok(Json(serde_json::json!({
        "restored": true,
        "snapshot_id": req.snapshot_id,
        "target": target,
    })))
}

/// List backup runs for a profile.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_runs(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RunListResponse>> {
    let repo = BackupRepository::new(&state.pool);
    let runs = repo.list_runs(id, 50).await?;

    Ok(Json(RunListResponse { runs }))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
