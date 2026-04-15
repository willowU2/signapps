//! `GET /history` — deployment history.

use crate::api::state::AppState;
use axum::{
    extract::{Query, State},
    response::Json,
    routing::get,
    Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::error::Error as AppError;
use utoipa::ToSchema;
use uuid::Uuid;

/// Query parameters for `GET /history`.
#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    /// Optional environment filter (`prod` or `dev`).
    pub env: Option<String>,
    /// Optional row limit (1..=500, default 50).
    pub limit: Option<i64>,
}

/// One row of the deployment history.
#[derive(Serialize, ToSchema, sqlx::FromRow)]
pub struct DeploymentEntry {
    /// Row identifier.
    pub id: Uuid,
    /// Environment (`prod` or `dev`).
    pub env: String,
    /// Deployed version.
    pub version: String,
    /// Status (`pending`, `running`, `success`, `failed`, ...).
    pub status: String,
    /// When the deploy was triggered.
    pub triggered_at: DateTime<Utc>,
    /// When it completed (null while in flight).
    pub completed_at: Option<DateTime<Utc>>,
    /// Duration in seconds (null while in flight).
    pub duration_seconds: Option<i32>,
    /// Error message if the deploy failed.
    pub error_message: Option<String>,
}

/// Return the deployment history, most-recent first.
///
/// # Errors
///
/// Returns `Error::Internal` if the underlying database query fails.
#[utoipa::path(
    get,
    path = "/api/v1/deploy/history",
    responses((status = 200, description = "Deployment history (most recent first)", body = [DeploymentEntry])),
    tag = "deploy"
)]
#[tracing::instrument(skip(state))]
pub async fn list_history(
    State(state): State<AppState>,
    Query(q): Query<HistoryQuery>,
) -> Result<Json<Vec<DeploymentEntry>>, AppError> {
    let limit = q.limit.unwrap_or(50).clamp(1, 500);
    let rows: Vec<DeploymentEntry> = match q.env {
        Some(env) => sqlx::query_as(
            "SELECT id, env, version, status, triggered_at, completed_at, \
                    duration_seconds, error_message \
             FROM deployments \
             WHERE env = $1 \
             ORDER BY triggered_at DESC LIMIT $2",
        )
        .bind(env)
        .bind(limit)
        .fetch_all(&state.pool)
        .await,
        None => sqlx::query_as(
            "SELECT id, env, version, status, triggered_at, completed_at, \
                    duration_seconds, error_message \
             FROM deployments \
             ORDER BY triggered_at DESC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&state.pool)
        .await,
    }
    .map_err(|e| AppError::Internal(format!("query: {e:#}")))?;
    Ok(Json(rows))
}

/// Build the router for deploy history endpoints.
pub fn router() -> Router<AppState> {
    Router::new().route("/history", get(list_history))
}
