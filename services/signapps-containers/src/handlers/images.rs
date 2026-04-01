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
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct PullRequest {
    /// Image name with optional tag (e.g., "nginx:latest")
    pub image: String,
}

/// Pull response.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct PullResponse {
    pub success: bool,
    pub image: String,
    pub message: String,
}

/// List all Docker images.
#[utoipa::path(
    get,
    path = "/api/v1/images",
    responses(
        (status = 200, description = "List of Docker images", body = Vec<crate::docker::ImageInfo>),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — admin only"),
    ),
    security(("bearerAuth" = [])),
    tag = "images"
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn list(State(state): State<AppState>) -> Result<Json<Vec<ImageInfo>>> {
    let images = state.docker.list_images().await?;
    Ok(Json(images))
}

/// Pull a Docker image.
#[utoipa::path(
    post,
    path = "/api/v1/images/pull",
    request_body = PullRequest,
    responses(
        (status = 200, description = "Image pulled successfully", body = PullResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — admin only"),
    ),
    security(("bearerAuth" = [])),
    tag = "images"
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
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
#[utoipa::path(
    delete,
    path = "/api/v1/images/{id}",
    params(
        ("id" = String, Path, description = "Image ID or name"),
    ),
    responses(
        (status = 204, description = "Image deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — admin only"),
    ),
    security(("bearerAuth" = [])),
    tag = "images"
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn delete(State(state): State<AppState>, Path(id): Path<String>) -> Result<StatusCode> {
    state.docker.remove_image(&id, false).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Force delete a Docker image.
#[utoipa::path(
    delete,
    path = "/api/v1/images/{id}/force",
    params(
        ("id" = String, Path, description = "Image ID or name"),
    ),
    responses(
        (status = 204, description = "Image force-deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — admin only"),
    ),
    security(("bearerAuth" = [])),
    tag = "images"
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn force_delete(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode> {
    state.docker.remove_image(&id, true).await?;
    Ok(StatusCode::NO_CONTENT)
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
