use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::AppState;
use signapps_common::Claims;

// ============================================================================
// Changelog types
// ============================================================================

#[derive(Debug, Serialize, FromRow, utoipa::ToSchema)]
/// ChangelogEntry data transfer object.
pub struct ChangelogEntry {
    pub id: Uuid,
    pub version: String,
    pub change_type: String,
    pub description: String,
    pub author: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for CreateChangelog.
pub struct CreateChangelogRequest {
    pub version: String,
    pub change_type: Option<String>,
    pub description: String,
    pub author: Option<String>,
}

// ============================================================================
// Pipeline types
// ============================================================================

#[derive(Debug, Serialize, FromRow, utoipa::ToSchema)]
/// Pipeline data transfer object.
pub struct Pipeline {
    pub id: Uuid,
    pub repo_name: String,
    pub branch: String,
    pub status: String,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for CreatePipeline.
pub struct CreatePipelineRequest {
    pub repo_name: String,
    pub branch: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for UpdatePipeline.
pub struct UpdatePipelineRequest {
    pub status: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

// ============================================================================
// Deployment types
// ============================================================================

#[derive(Debug, Serialize, FromRow, utoipa::ToSchema)]
/// Deployment data transfer object.
pub struct Deployment {
    pub id: Uuid,
    pub service_name: String,
    pub version: String,
    pub commit_message: String,
    pub status: String,
    pub deployed_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for CreateDeployment.
pub struct CreateDeploymentRequest {
    pub service_name: String,
    pub version: String,
    pub commit_message: Option<String>,
    pub status: Option<String>,
}

// ============================================================================
// Changelog handlers
// ============================================================================

/// List changelog entries.
#[utoipa::path(
    get,
    path = "/api/v1/devops/changelog",
    responses(
        (status = 200, description = "Changelog entries", body = Vec<ChangelogEntry>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "DevOps"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_changelog(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let rows = sqlx::query_as::<_, ChangelogEntry>(
        r#"SELECT id, version, change_type, description, author, created_at
           FROM ops.changelog
           ORDER BY created_at DESC
           LIMIT 200"#,
    )
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to list changelog: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "data": rows })))
}

/// Create a changelog entry.
#[utoipa::path(
    post,
    path = "/api/v1/devops/changelog",
    request_body = CreateChangelogRequest,
    responses(
        (status = 201, description = "Changelog entry created", body = ChangelogEntry),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "DevOps"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create_changelog(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateChangelogRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    if payload.version.trim().is_empty() || payload.description.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let change_type = payload
        .change_type
        .unwrap_or_else(|| "improvement".to_string());
    let author = payload.author.unwrap_or_else(|| claims.sub.to_string());

    let row = sqlx::query_as::<_, ChangelogEntry>(
        r#"INSERT INTO ops.changelog (version, change_type, description, author)
           VALUES ($1, $2, $3, $4)
           RETURNING id, version, change_type, description, author, created_at"#,
    )
    .bind(payload.version.trim())
    .bind(&change_type)
    .bind(payload.description.trim())
    .bind(&author)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to create changelog entry: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": row })),
    ))
}

// ============================================================================
// Pipeline handlers
// ============================================================================

/// List CI/CD pipelines.
#[utoipa::path(
    get,
    path = "/api/v1/devops/pipelines",
    responses(
        (status = 200, description = "Pipeline list", body = Vec<Pipeline>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "DevOps"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_pipelines(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let rows = sqlx::query_as::<_, Pipeline>(
        r#"SELECT id, repo_name, branch, status, started_at, completed_at, created_at
           FROM ops.pipelines
           ORDER BY created_at DESC
           LIMIT 200"#,
    )
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to list pipelines: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "data": rows })))
}

/// Create a pipeline.
#[utoipa::path(
    post,
    path = "/api/v1/devops/pipelines",
    request_body = CreatePipelineRequest,
    responses(
        (status = 201, description = "Pipeline created", body = Pipeline),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "DevOps"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create_pipeline(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<CreatePipelineRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    if payload.repo_name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let branch = payload.branch.unwrap_or_else(|| "main".to_string());
    let status = payload.status.unwrap_or_else(|| "pending".to_string());

    let row = sqlx::query_as::<_, Pipeline>(
        r#"INSERT INTO ops.pipelines (repo_name, branch, status)
           VALUES ($1, $2, $3)
           RETURNING id, repo_name, branch, status, started_at, completed_at, created_at"#,
    )
    .bind(payload.repo_name.trim())
    .bind(&branch)
    .bind(&status)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to create pipeline: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": row })),
    ))
}

/// Update a pipeline.
#[utoipa::path(
    put,
    path = "/api/v1/devops/pipelines/{id}",
    params(("id" = Uuid, Path, description = "Pipeline ID")),
    request_body = UpdatePipelineRequest,
    responses(
        (status = 200, description = "Pipeline updated", body = Pipeline),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "DevOps"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn update_pipeline(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePipelineRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let row = sqlx::query_as::<_, Pipeline>(
        r#"UPDATE ops.pipelines
           SET status       = COALESCE($1, status),
               started_at   = COALESCE($2, started_at),
               completed_at = COALESCE($3, completed_at)
           WHERE id = $4
           RETURNING id, repo_name, branch, status, started_at, completed_at, created_at"#,
    )
    .bind(payload.status.as_deref())
    .bind(payload.started_at)
    .bind(payload.completed_at)
    .bind(id)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to update pipeline: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({ "data": row })))
}

// ============================================================================
// Deployment handlers
// ============================================================================

/// List deployments.
#[utoipa::path(
    get,
    path = "/api/v1/devops/deployments",
    responses(
        (status = 200, description = "Deployment list", body = Vec<Deployment>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "DevOps"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_deployments(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let rows = sqlx::query_as::<_, Deployment>(
        r#"SELECT id, service_name, version, commit_message, status, deployed_by, created_at
           FROM ops.deployments
           ORDER BY created_at DESC
           LIMIT 200"#,
    )
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to list deployments: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "data": rows })))
}

/// Create a deployment.
#[utoipa::path(
    post,
    path = "/api/v1/devops/deployments",
    request_body = CreateDeploymentRequest,
    responses(
        (status = 201, description = "Deployment created", body = Deployment),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "DevOps"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create_deployment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateDeploymentRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    if payload.service_name.trim().is_empty() || payload.version.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let commit_message = payload.commit_message.unwrap_or_default();
    let status = payload.status.unwrap_or_else(|| "pending".to_string());

    let row = sqlx::query_as::<_, Deployment>(
        r#"INSERT INTO ops.deployments (service_name, version, commit_message, status, deployed_by)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, service_name, version, commit_message, status, deployed_by, created_at"#,
    )
    .bind(payload.service_name.trim())
    .bind(payload.version.trim())
    .bind(&commit_message)
    .bind(&status)
    .bind(claims.sub)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to create deployment: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": row })),
    ))
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
