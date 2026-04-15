//! `GET /envs` and `GET /envs/:env/health`.

use crate::{api::state::AppState, docker::DockerClient, persistence};
use axum::{
    extract::{Path, State},
    response::Json,
    routing::get,
    Router,
};
use chrono::{DateTime, Utc};
use serde::Serialize;
use signapps_common::error::Error as AppError;
use std::collections::HashMap;
use utoipa::ToSchema;

/// Current state of one environment.
#[derive(Serialize, ToSchema)]
pub struct EnvStatus {
    /// Environment name (`prod` or `dev`).
    pub env: String,
    /// Currently deployed version, if any.
    pub current_version: Option<String>,
    /// Timestamp of the last successful deploy, if any.
    pub deployed_at: Option<DateTime<Utc>>,
}

/// Health snapshot of one environment's stack.
#[derive(Serialize, ToSchema)]
pub struct EnvHealth {
    /// Environment name.
    pub env: String,
    /// Map of container name to `is_healthy`.
    pub containers: HashMap<String, bool>,
    /// Number of healthy containers.
    pub healthy: usize,
    /// Total number of containers in the compose project.
    pub total: usize,
}

/// List environments and their current versions.
///
/// # Errors
///
/// Returns `Error::Internal` if the underlying database query fails.
#[utoipa::path(
    get,
    path = "/api/v1/deploy/envs",
    responses((status = 200, description = "Environments and their current versions", body = [EnvStatus])),
    tag = "deploy"
)]
#[tracing::instrument(skip(state))]
pub async fn list_envs(State(state): State<AppState>) -> Result<Json<Vec<EnvStatus>>, AppError> {
    let mut out = Vec::new();
    for env in ["prod", "dev"] {
        let last = persistence::last_successful(&state.pool, env)
            .await
            .map_err(|e| AppError::Internal(format!("query: {e:#}")))?;
        out.push(EnvStatus {
            env: env.to_string(),
            current_version: last.as_ref().map(|(v, _)| v.clone()),
            deployed_at: last.as_ref().map(|(_, d)| *d),
        });
    }
    Ok(Json(out))
}

/// Return container health for one environment's compose project.
///
/// # Errors
///
/// Returns `Error::BadRequest` if `env` is not `prod` or `dev`, or
/// `Error::Internal` if the Docker daemon is unreachable.
#[utoipa::path(
    get,
    path = "/api/v1/deploy/envs/{env}/health",
    params(("env" = String, Path, description = "'prod' or 'dev'")),
    responses((status = 200, description = "Container health", body = EnvHealth)),
    tag = "deploy"
)]
#[tracing::instrument]
pub async fn env_health(Path(env): Path<String>) -> Result<Json<EnvHealth>, AppError> {
    if env != "prod" && env != "dev" {
        return Err(AppError::BadRequest(format!("unknown env: {env}")));
    }
    let project = match env.as_str() {
        "prod" => "signapps-prod",
        "dev" => "signapps-staging",
        _ => unreachable!(),
    };
    let docker = DockerClient::connect()
        .map_err(|e| AppError::Internal(format!("docker connect: {e:#}")))?;
    let containers = docker
        .health_by_project(project)
        .await
        .map_err(|e| AppError::Internal(format!("docker query: {e:#}")))?;
    let total = containers.len();
    let healthy = containers.values().filter(|h| **h).count();
    Ok(Json(EnvHealth {
        env,
        containers,
        healthy,
        total,
    }))
}

/// Build the router for environment-related endpoints.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/envs", get(list_envs))
        .route("/envs/:env/health", get(env_health))
}
