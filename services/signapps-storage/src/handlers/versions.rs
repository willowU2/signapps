use crate::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

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
    axum::Extension(_user_id): axum::Extension<Uuid>,
    Path((file_id, version_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, String)> {
    // 1. Validate the version exists
    let version = StorageTier2Repository::get_version(state.pool.inner(), version_id)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Version not found".into()))?;

    // 2. Need to ensure the version belongs to the actual file being requested
    if version.file_id != file_id {
        return Err((
            StatusCode::BAD_REQUEST,
            "Version does not belong to this file".into(),
        ));
    }

    // 3. Get the current active file info
    let (bucket, key, active_size, active_content_type) =
        StorageTier2Repository::get_file_info(state.pool.inner(), file_id)
            .await
            .map_err(|_| (StatusCode::NOT_FOUND, "Active file not found".into()))?;

    // 4. Archive the current active file before overwriting it (safety measure)
    // We create a new version record for the active blob so it's not lost
    let archive_key = format!("versions/{}/{}", file_id, Uuid::new_v4());

    // Copy the active blob to a new archive location
    state
        .storage
        .copy_object(&bucket, &key, &bucket, &archive_key)
        .await
        .map_err(internal_error)?;

    // Insert the new version record for the active state
    StorageTier2Repository::add_file_version(
        state.pool.inner(),
        file_id,
        active_size,
        active_content_type.clone(),
        archive_key,
    )
    .await
    .map_err(internal_error)?;

    // 5. Restore the requested version's payload over the active file key
    state
        .storage
        .copy_object(&bucket, &version.storage_key, &bucket, &key)
        .await
        .map_err(internal_error)?;

    // 6. Update the active file metadata reflecting the restored version
    StorageTier2Repository::update_file_metadata(
        state.pool.inner(),
        file_id,
        version.size,
        version.content_type.clone(),
    )
    .await
    .map_err(internal_error)?;

    // Note: Quotas logic shouldn't strictly require recalculation here because we just overwrote bytes, but storage quotas for the new archive version should ideally be incremented in a full prod app.

    Ok(StatusCode::OK)
}
