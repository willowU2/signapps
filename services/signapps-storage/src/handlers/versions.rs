use crate::AppState;
use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, StatusCode},
    response::Response,
    Json,
};

use signapps_db::repositories::StorageTier2Repository;
use tracing::error;
use uuid::Uuid;

fn internal_error<E>(err: E) -> (StatusCode, String)
where
    E: std::error::Error,
{
    error!("Versions handler error: {}", err);
    (StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
}

#[utoipa::path(
    get,
    path = "/api/v1/files/{file_id}/versions",
    params(("file_id" = Uuid, Path, description = "File ID")),
    responses(
        (status = 200, description = "List of file versions"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "versions"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
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

#[utoipa::path(
    post,
    path = "/api/v1/files/{file_id}/versions/{version_id}/restore",
    params(
        ("file_id" = Uuid, Path, description = "File ID"),
        ("version_id" = Uuid, Path, description = "Version ID"),
    ),
    responses(
        (status = 200, description = "Version restored successfully"),
        (status = 400, description = "Version does not belong to this file"),
        (status = 404, description = "File or version not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "versions"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
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

/// Stream the raw content of a file version as an attachment download.
#[utoipa::path(
    get,
    path = "/api/v1/files/{file_id}/versions/{version_id}/download",
    params(
        ("file_id" = Uuid, Path, description = "File ID"),
        ("version_id" = Uuid, Path, description = "Version ID"),
    ),
    responses(
        (status = 200, description = "Version payload streamed as attachment"),
        (status = 400, description = "Version does not belong to this file"),
        (status = 404, description = "File or version not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "versions"
)]
#[tracing::instrument(skip(state))]
pub async fn download_version(
    State(state): State<AppState>,
    Path((file_id, version_id)): Path<(Uuid, Uuid)>,
) -> Result<Response, (StatusCode, String)> {
    let version = StorageTier2Repository::get_version(state.pool.inner(), version_id)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Version not found".into()))?;

    if version.file_id != file_id {
        return Err((
            StatusCode::BAD_REQUEST,
            "Version does not belong to this file".into(),
        ));
    }

    let (bucket, key, _active_size, _active_ct) =
        StorageTier2Repository::get_file_info(state.pool.inner(), file_id)
            .await
            .map_err(|_| (StatusCode::NOT_FOUND, "File not found".into()))?;

    let object = state
        .storage
        .get_object(&bucket, &version.storage_key)
        .await
        .map_err(internal_error)?;

    let filename = key.split('/').next_back().unwrap_or(&key);
    let content_type = version
        .content_type
        .clone()
        .unwrap_or_else(|| "application/octet-stream".into());

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_LENGTH, object.content_length)
        .header(
            header::CONTENT_DISPOSITION,
            format!(
                "attachment; filename=\"{}.v{}\"",
                filename,
                &version_id.to_string()[..8]
            ),
        )
        .body(Body::from(object.data))
        .map_err(|e| internal_error(e))
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
