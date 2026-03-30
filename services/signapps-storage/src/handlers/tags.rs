use crate::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use signapps_db::models::storage_tier2::{CreateTagRequest, UpdateTagRequest};
use signapps_db::repositories::storage_tier2_repository::StorageTier2Repository;
use tracing::error;
use uuid::Uuid;

/// Custom error response for handler
fn internal_error<E>(err: E) -> (StatusCode, String)
where
    E: std::error::Error,
{
    error!("Tags handler error: {}", err);
    (StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
}

// ---------------------------------------------------------
// Global User Tags
// ---------------------------------------------------------

#[tracing::instrument(skip_all)]
pub async fn list_tags(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
) -> Result<Json<Vec<signapps_db::models::storage_tier2::Tag>>, (StatusCode, String)> {
    let tags = StorageTier2Repository::get_user_tags(state.pool.inner(), user_id)
        .await
        .map_err(internal_error)?;

    Ok(Json(tags))
}

#[tracing::instrument(skip_all)]
pub async fn create_tag(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Json(payload): Json<CreateTagRequest>,
) -> Result<(StatusCode, Json<signapps_db::models::storage_tier2::Tag>), (StatusCode, String)> {
    let tag = StorageTier2Repository::create_tag(state.pool.inner(), user_id, &payload)
        .await
        .map_err(internal_error)?;

    Ok((StatusCode::CREATED, Json(tag)))
}

#[tracing::instrument(skip_all)]
pub async fn update_tag(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Path(tag_id): Path<Uuid>,
    Json(payload): Json<UpdateTagRequest>,
) -> Result<Json<signapps_db::models::storage_tier2::Tag>, (StatusCode, String)> {
    let tag = StorageTier2Repository::update_tag(state.pool.inner(), tag_id, user_id, &payload)
        .await
        .map_err(internal_error)?;

    Ok(Json(tag))
}

#[tracing::instrument(skip_all)]
pub async fn delete_tag(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Path(tag_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let affected = StorageTier2Repository::delete_tag(state.pool.inner(), tag_id, user_id)
        .await
        .map_err(internal_error)?;

    if affected == 0 {
        return Err((StatusCode::NOT_FOUND, "Tag not found".into()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------
// File <-> Tags Association
// ---------------------------------------------------------

#[tracing::instrument(skip_all)]
pub async fn list_file_tags(
    State(state): State<AppState>,
    Path(file_id): Path<Uuid>,
    // In a real app we need to check if user has access to this file_id
) -> Result<Json<Vec<signapps_db::models::storage_tier2::FileTagResponse>>, (StatusCode, String)> {
    let tags = StorageTier2Repository::get_file_tags(state.pool.inner(), file_id)
        .await
        .map_err(internal_error)?;

    Ok(Json(tags))
}

#[tracing::instrument(skip_all)]
pub async fn add_file_tag(
    State(state): State<AppState>,
    Path((file_id, tag_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, String)> {
    StorageTier2Repository::add_file_tag(state.pool.inner(), file_id, tag_id)
        .await
        .map_err(internal_error)?;

    Ok(StatusCode::CREATED)
}

#[tracing::instrument(skip_all)]
pub async fn remove_file_tag(
    State(state): State<AppState>,
    Path((file_id, tag_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, String)> {
    let affected = StorageTier2Repository::remove_file_tag(state.pool.inner(), file_id, tag_id)
        .await
        .map_err(internal_error)?;

    if affected == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            "Tag not associated with this file".into(),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}
