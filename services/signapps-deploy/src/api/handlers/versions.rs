//! `GET /versions` — distinct versions ever deployed (from deployments table).

use crate::api::state::AppState;
use axum::{extract::State, response::Json, routing::get, Router};
use chrono::{DateTime, Utc};
use serde::Serialize;
use signapps_common::error::Error as AppError;
use utoipa::ToSchema;

/// One distinct version with its last deploy time and the envs that have run it.
#[derive(Serialize, ToSchema, sqlx::FromRow)]
pub struct VersionEntry {
    /// Version string (typically a git SHA or semver tag).
    pub version: String,
    /// Last time this version completed a successful deploy.
    pub last_deployed_at: DateTime<Utc>,
    /// Environments that have deployed this version successfully.
    pub envs: Vec<String>,
}

/// List distinct versions that were ever deployed successfully.
///
/// # Errors
///
/// Returns `Error::Internal` if the underlying database query fails.
#[utoipa::path(
    get,
    path = "/api/v1/deploy/versions",
    responses((status = 200, description = "Distinct versions ever deployed", body = [VersionEntry])),
    tag = "deploy"
)]
#[tracing::instrument(skip(state))]
pub async fn list_versions(
    State(state): State<AppState>,
) -> Result<Json<Vec<VersionEntry>>, AppError> {
    let rows: Vec<VersionEntry> = sqlx::query_as(
        "SELECT version, \
                MAX(completed_at) AS last_deployed_at, \
                ARRAY_AGG(DISTINCT env) AS envs \
         FROM deployments \
         WHERE status = 'success' \
         GROUP BY version \
         ORDER BY last_deployed_at DESC \
         LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Internal(format!("query: {e:#}")))?;
    Ok(Json(rows))
}

/// Build the router for version-related endpoints.
pub fn router() -> Router<AppState> {
    Router::new().route("/versions", get(list_versions))
}
