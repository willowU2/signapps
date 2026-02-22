use crate::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use signapps_common::middleware::Claims;
use signapps_db::repositories::storage_tier2_repository::StorageTier2Repository;
use tracing::error;
use uuid::Uuid;

fn internal_error<E>(err: E) -> (StatusCode, String)
where
    E: std::error::Error,
{
    error!("Versions handler error: {}", err);
    (StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
}

pub async fn list_versions(
    State(state): State<AppState>,
    Path(file_id): Path<Uuid>,
    // Auth check should happen here in a real app
) -> Result<Json<Vec<signapps_db::models::storage_tier2::FileVersion>>, (StatusCode, String)> {
    let versions = StorageTier2Repository::get_file_versions(state.pool.inner(), file_id)
        .await
        .map_err(internal_error)?;

    Ok(Json(versions))
}

pub async fn restore_version(
    State(state): State<AppState>,
    claims: Claims,
    Path((file_id, version_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, String)> {
    // 1. Validate the version exists
    let version = StorageTier2Repository::get_version(state.pool.inner(), version_id)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Version not found".into()))?;

    // In a real implementation:
    // 2. We would copy the file content from `version.storage_key` to the current file's key
    // 3. Or update the pointers in `storage.files` to point to the older data

    // For now, we return 501 Not Implemented since the OpenDAL copy logic
    // would belong here but requires the storage `operator`.

    Ok(StatusCode::NOT_IMPLEMENTED)
}
