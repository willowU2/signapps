//! Docker image management handlers.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::Result;

use crate::docker::ImageInfo;
use crate::AppState;

/// Pull image request.
#[derive(Debug, Deserialize)]
pub struct PullRequest {
    /// Image name with optional tag (e.g., "nginx:latest")
    pub image: String,
}

/// Pull response.
#[derive(Debug, Serialize)]
pub struct PullResponse {
    pub success: bool,
    pub image: String,
    pub message: String,
}

/// List all Docker images.
#[tracing::instrument(skip(state))]
pub async fn list(State(state): State<AppState>) -> Result<Json<Vec<ImageInfo>>> {
    let images = state.docker.list_images().await?;
    Ok(Json(images))
}

/// Pull a Docker image.
#[tracing::instrument(skip(state))]
pub async fn pull(
    State(state): State<AppState>,
    Json(payload): Json<PullRequest>,
) -> Result<Json<PullResponse>> {
    state.docker.pull_image(&payload.image).await?;

    Ok(Json(PullResponse {
        success: true,
        image: payload.image.clone(),
        message: format!("Image {} pulled successfully", payload.image),
    }))
}

/// Delete a Docker image.
#[tracing::instrument(skip(state))]
pub async fn delete(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode> {
    state.docker.remove_image(&id, false).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Force delete a Docker image.
#[tracing::instrument(skip(state))]
pub async fn force_delete(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode> {
    state.docker.remove_image(&id, true).await?;
    Ok(StatusCode::NO_CONTENT)
}
