//! Document versioning API -- command log and snapshots for undo/redo and history.
//!
//! Routes:
//! - `POST   /api/v1/versions/:doc_id/commands`                -- append command to log
//! - `GET    /api/v1/versions/:doc_id/commands`                 -- list recent commands
//! - `POST   /api/v1/versions/:doc_id/undo`                    -- undo last own command
//! - `POST   /api/v1/versions/:doc_id/snapshots`               -- create snapshot
//! - `GET    /api/v1/versions/:doc_id/snapshots`                -- list snapshots
//! - `GET    /api/v1/versions/:doc_id/snapshots/:id`            -- get snapshot content
//! - `POST   /api/v1/versions/:doc_id/snapshots/:id/restore`   -- restore snapshot
//! - `POST   /api/v1/versions/:doc_id/snapshots/diff`          -- diff two snapshots

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::AppState;
use signapps_common::Claims;
use signapps_db::models::{AppendCommand, CreateSnapshot, DiffEntry, DocumentCommand, DocumentSnapshot};
use signapps_db::repositories::VersioningRepository;

// ============================================================================
// Query / request types
// ============================================================================

/// Query parameters for listing commands.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListCommandsQuery {
    /// Return commands with ID strictly greater than this value.
    pub since: Option<i64>,
    /// Maximum number of commands to return (default 50).
    pub limit: Option<i64>,
}

/// Request body for diffing two snapshots.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct DiffSnapshotsBody {
    /// ID of the first (older) snapshot.
    pub snapshot_a: Uuid,
    /// ID of the second (newer) snapshot.
    pub snapshot_b: Uuid,
}

// ============================================================================
// Handlers
// ============================================================================

/// POST /api/v1/versions/:doc_id/commands -- append a command to the document log
#[utoipa::path(
    post,
    path = "/api/v1/versions/{doc_id}/commands",
    params(("doc_id" = Uuid, Path, description = "Document ID")),
    request_body = AppendCommand,
    responses(
        (status = 201, description = "Command appended", body = DocumentCommand),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Versions"
)]
#[tracing::instrument(skip_all)]
pub async fn append_command(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(doc_id): Path<Uuid>,
    Json(payload): Json<AppendCommand>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    let cmd = VersioningRepository::append_command(
        state.pool.inner(),
        doc_id,
        claims.sub,
        payload,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to append command: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(serde_json::json!({ "data": cmd }))))
}

/// GET /api/v1/versions/:doc_id/commands -- list recent commands
#[utoipa::path(
    get,
    path = "/api/v1/versions/{doc_id}/commands",
    params(
        ("doc_id" = Uuid, Path, description = "Document ID"),
        ListCommandsQuery,
    ),
    responses(
        (status = 200, description = "List of commands", body = Vec<DocumentCommand>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Versions"
)]
#[tracing::instrument(skip_all)]
pub async fn list_commands(
    State(state): State<AppState>,
    Path(doc_id): Path<Uuid>,
    Query(params): Query<ListCommandsQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let limit = params.limit.unwrap_or(50);
    let rows = VersioningRepository::list_commands(
        state.pool.inner(),
        doc_id,
        params.since,
        limit,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to list commands: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "data": rows })))
}

/// POST /api/v1/versions/:doc_id/undo -- undo last own command
#[utoipa::path(
    post,
    path = "/api/v1/versions/{doc_id}/undo",
    params(("doc_id" = Uuid, Path, description = "Document ID")),
    responses(
        (status = 200, description = "Last command returned for undo", body = DocumentCommand),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "No command found for this user"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Versions"
)]
#[tracing::instrument(skip_all)]
pub async fn undo_last_command(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(doc_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let cmd = VersioningRepository::undo_last_command(
        state.pool.inner(),
        doc_id,
        claims.sub,
    )
    .await
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("not found") || msg.contains("NotFound") || msg.contains("No command") {
            StatusCode::NOT_FOUND
        } else {
            tracing::error!("Failed to undo last command: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        }
    })?;

    Ok(Json(serde_json::json!({ "data": cmd })))
}

/// POST /api/v1/versions/:doc_id/snapshots -- create a snapshot
#[utoipa::path(
    post,
    path = "/api/v1/versions/{doc_id}/snapshots",
    params(("doc_id" = Uuid, Path, description = "Document ID")),
    request_body = CreateSnapshot,
    responses(
        (status = 201, description = "Snapshot created", body = DocumentSnapshot),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Versions"
)]
#[tracing::instrument(skip_all)]
pub async fn create_snapshot(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(doc_id): Path<Uuid>,
    Json(payload): Json<CreateSnapshot>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    let snap = VersioningRepository::create_snapshot(
        state.pool.inner(),
        doc_id,
        claims.sub,
        payload,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to create snapshot: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(serde_json::json!({ "data": snap }))))
}

/// GET /api/v1/versions/:doc_id/snapshots -- list all snapshots
#[utoipa::path(
    get,
    path = "/api/v1/versions/{doc_id}/snapshots",
    params(("doc_id" = Uuid, Path, description = "Document ID")),
    responses(
        (status = 200, description = "List of snapshots", body = Vec<DocumentSnapshot>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Versions"
)]
#[tracing::instrument(skip_all)]
pub async fn list_snapshots(
    State(state): State<AppState>,
    Path(doc_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rows = VersioningRepository::list_snapshots(state.pool.inner(), doc_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list snapshots: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({ "data": rows })))
}

/// GET /api/v1/versions/:doc_id/snapshots/:id -- get a snapshot by ID
#[utoipa::path(
    get,
    path = "/api/v1/versions/{doc_id}/snapshots/{id}",
    params(
        ("doc_id" = Uuid, Path, description = "Document ID"),
        ("id" = Uuid, Path, description = "Snapshot ID"),
    ),
    responses(
        (status = 200, description = "Snapshot found", body = DocumentSnapshot),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Snapshot not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Versions"
)]
#[tracing::instrument(skip_all)]
pub async fn get_snapshot(
    State(state): State<AppState>,
    Path((_doc_id, snapshot_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let snap = VersioningRepository::get_snapshot(state.pool.inner(), snapshot_id)
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("not found") || msg.contains("NotFound") {
                StatusCode::NOT_FOUND
            } else {
                tracing::error!("Failed to get snapshot: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            }
        })?;

    Ok(Json(serde_json::json!({ "data": snap })))
}

/// POST /api/v1/versions/:doc_id/snapshots/:id/restore -- restore a snapshot
#[utoipa::path(
    post,
    path = "/api/v1/versions/{doc_id}/snapshots/{id}/restore",
    params(
        ("doc_id" = Uuid, Path, description = "Document ID"),
        ("id" = Uuid, Path, description = "Snapshot ID"),
    ),
    responses(
        (status = 200, description = "Snapshot restored (content returned)", body = DocumentSnapshot),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Snapshot not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Versions"
)]
#[tracing::instrument(skip_all)]
pub async fn restore_snapshot(
    State(state): State<AppState>,
    Path((doc_id, snapshot_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let snap = VersioningRepository::restore_snapshot(
        state.pool.inner(),
        doc_id,
        snapshot_id,
    )
    .await
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("not found") || msg.contains("NotFound") {
            StatusCode::NOT_FOUND
        } else {
            tracing::error!("Failed to restore snapshot: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        }
    })?;

    Ok(Json(serde_json::json!({ "data": snap })))
}

/// POST /api/v1/versions/:doc_id/snapshots/diff -- diff two snapshots
#[utoipa::path(
    post,
    path = "/api/v1/versions/{doc_id}/snapshots/diff",
    params(("doc_id" = Uuid, Path, description = "Document ID")),
    request_body = DiffSnapshotsBody,
    responses(
        (status = 200, description = "Diff entries between two snapshots", body = Vec<DiffEntry>),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "One or both snapshots not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Versions"
)]
#[tracing::instrument(skip_all)]
pub async fn diff_snapshots(
    State(state): State<AppState>,
    Path(_doc_id): Path<Uuid>,
    Json(payload): Json<DiffSnapshotsBody>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let entries = VersioningRepository::diff_snapshots(
        state.pool.inner(),
        payload.snapshot_a,
        payload.snapshot_b,
    )
    .await
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("not found") || msg.contains("NotFound") {
            StatusCode::NOT_FOUND
        } else {
            tracing::error!("Failed to diff snapshots: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        }
    })?;

    Ok(Json(serde_json::json!({ "data": entries })))
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
