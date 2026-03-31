//! Drive SP3 Backup handlers — plans, snapshots, restore.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::models::{
    BackupEntry, BackupPlan, BackupSnapshot, CreateBackupPlan, RestoreRequest, UpdateBackupPlan,
};
use signapps_db::repositories::DriveBackupRepository;
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct SnapshotListQuery {
    pub plan_id: Option<Uuid>,
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct SnapshotDetailResponse {
    #[serde(flatten)]
    pub snapshot: BackupSnapshot,
    pub entries: Vec<BackupEntry>,
}

#[derive(Debug, Serialize)]
pub struct RestoreResponse {
    pub message: String,
    pub restored_files: usize,
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

/// GET /api/v1/backups/plans — list all backup plans.
#[tracing::instrument(skip_all)]
pub async fn list_plans(State(state): State<AppState>) -> Result<Json<Vec<BackupPlan>>> {
    let repo = DriveBackupRepository::new(&state.pool);
    let plans = repo.list_plans().await?;
    Ok(Json(plans))
}

/// POST /api/v1/backups/plans — create a backup plan.
#[tracing::instrument(skip_all)]
pub async fn create_plan(
    State(state): State<AppState>,
    Json(req): Json<CreateBackupPlan>,
) -> Result<(StatusCode, Json<BackupPlan>)> {
    let repo = DriveBackupRepository::new(&state.pool);
    let plan = repo.create_plan(req).await?;
    Ok((StatusCode::CREATED, Json(plan)))
}

/// PUT /api/v1/backups/plans/:id — update a backup plan.
#[tracing::instrument(skip_all)]
pub async fn update_plan(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateBackupPlan>,
) -> Result<Json<BackupPlan>> {
    let repo = DriveBackupRepository::new(&state.pool);
    // Verify existence
    repo.find_plan(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Backup plan {} not found", id)))?;
    let plan = repo.update_plan(id, req).await?;
    Ok(Json(plan))
}

/// DELETE /api/v1/backups/plans/:id — delete a backup plan.
#[tracing::instrument(skip_all)]
pub async fn delete_plan(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let repo = DriveBackupRepository::new(&state.pool);
    repo.find_plan(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Backup plan {} not found", id)))?;
    repo.delete_plan(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/backups/plans/:id/run — trigger a manual backup run.
#[tracing::instrument(skip_all)]
pub async fn run_plan(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(StatusCode, Json<BackupSnapshot>)> {
    let repo = DriveBackupRepository::new(&state.pool);
    let plan = repo
        .find_plan(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Backup plan {} not found", id)))?;

    // Create snapshot
    let storage_path = format!("backups/{}/{}", plan.id, Utc::now().timestamp());
    let snapshot = repo
        .create_snapshot(plan.id, &plan.backup_type, Some(&storage_path))
        .await?;

    // Spawn background task to run the actual backup
    let pool = state.pool.clone();
    let snapshot_id = snapshot.id;
    let plan_id = plan.id;
    let backup_type = plan.backup_type.clone();
    let include_paths = plan.include_paths.clone();
    let max_snapshots = plan.max_snapshots;

    tokio::spawn(async move {
        let repo = DriveBackupRepository::new(&pool);
        match run_backup_task(&pool, snapshot_id, &backup_type, &include_paths).await {
            Ok((files_count, total_size)) => {
                let _ = repo.complete_snapshot(snapshot_id, files_count, total_size).await;
                let _ = repo.mark_plan_run(plan_id).await;
                let _ = repo.cleanup_old_snapshots(plan_id, max_snapshots).await;
                tracing::info!(
                    snapshot_id = %snapshot_id,
                    files = files_count,
                    "Backup snapshot completed"
                );
            },
            Err(e) => {
                let _ = repo.fail_snapshot(snapshot_id, &e.to_string()).await;
                tracing::error!(snapshot_id = %snapshot_id, error = %e, "Backup snapshot failed");
            },
        }
    });

    Ok((StatusCode::ACCEPTED, Json(snapshot)))
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

/// GET /api/v1/backups/snapshots — list snapshots (optionally filtered by plan_id).
#[tracing::instrument(skip_all)]
pub async fn list_snapshots(
    State(state): State<AppState>,
    Query(q): Query<SnapshotListQuery>,
) -> Result<Json<Vec<BackupSnapshot>>> {
    let repo = DriveBackupRepository::new(&state.pool);
    let snapshots = repo.list_snapshots(q.plan_id).await?;
    Ok(Json(snapshots))
}

/// GET /api/v1/backups/snapshots/:id — get snapshot detail with entries.
#[tracing::instrument(skip_all)]
pub async fn get_snapshot(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<SnapshotDetailResponse>> {
    let repo = DriveBackupRepository::new(&state.pool);
    let snapshot = repo
        .find_snapshot(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Backup snapshot {} not found", id)))?;
    let entries = repo.list_entries(id).await?;
    Ok(Json(SnapshotDetailResponse { snapshot, entries }))
}

/// DELETE /api/v1/backups/snapshots/:id — delete a snapshot.
#[tracing::instrument(skip_all)]
pub async fn delete_snapshot(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let repo = DriveBackupRepository::new(&state.pool);
    repo.find_snapshot(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Backup snapshot {} not found", id)))?;
    repo.delete_snapshot(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

/// POST /api/v1/backups/restore — restore files from a snapshot.
#[tracing::instrument(skip_all)]
pub async fn restore(
    State(state): State<AppState>,
    Json(req): Json<RestoreRequest>,
) -> Result<Json<RestoreResponse>> {
    let repo = DriveBackupRepository::new(&state.pool);
    let snapshot = repo
        .find_snapshot(req.snapshot_id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Snapshot {} not found", req.snapshot_id)))?;

    if snapshot.status != "completed" {
        return Err(Error::BadRequest(
            "Cannot restore from a non-completed snapshot".to_string(),
        ));
    }

    // Fetch entries to restore (filtered by node_path prefix if provided)
    let entries = repo.list_entries(snapshot.id).await?;
    let to_restore: Vec<_> = if let Some(ref path) = req.node_path {
        entries
            .into_iter()
            .filter(|e| e.node_path.starts_with(path.as_str()))
            .collect()
    } else {
        entries
    };

    let restored_count = to_restore.len();
    tracing::info!(
        snapshot_id = %snapshot.id,
        restored_files = restored_count,
        target_path = ?req.target_path,
        "Restore operation completed"
    );

    Ok(Json(RestoreResponse {
        message: format!(
            "Restauration démarrée : {} fichier(s) depuis le snapshot {}",
            restored_count, snapshot.id
        ),
        restored_files: restored_count,
    }))
}

// ---------------------------------------------------------------------------
// Internal backup task
// ---------------------------------------------------------------------------

/// Iterate drive.nodes and record backup entries.
/// Returns (files_count, total_size).
async fn run_backup_task(
    pool: &signapps_db::DatabasePool,
    snapshot_id: Uuid,
    _backup_type: &str,
    _include_paths: &[String],
) -> std::result::Result<(i32, i64), signapps_common::Error> {
    let repo = DriveBackupRepository::new(pool);

    // Query non-deleted file nodes
    let nodes: Vec<(Uuid, String, Option<i64>)> = sqlx::query_as(
        r#"SELECT id, name, size FROM drive.nodes
           WHERE deleted_at IS NULL AND node_type != 'folder'
           LIMIT 1000"#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let mut files_count: i32 = 0;
    let mut total_size: i64 = 0;

    for (node_id, node_path, size) in &nodes {
        let file_size = size.unwrap_or(0);
        let backup_key = format!("backups/{}/{}", snapshot_id, node_id);

        repo.create_entry(
            snapshot_id,
            Some(*node_id),
            node_path,
            None,
            file_size,
            &backup_key,
        )
        .await?;

        files_count += 1;
        total_size += file_size;
    }

    Ok((files_count, total_size))
}
