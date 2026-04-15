//! Feature flags CRUD endpoints.

use crate::api::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use signapps_common::error::Error as AppError;
use signapps_feature_flags::FeatureFlag;
use utoipa::ToSchema;
use uuid::Uuid;

/// Query parameters carrying the environment filter.
#[derive(Debug, Deserialize)]
pub struct EnvQuery {
    /// Optional environment (e.g. "prod", "staging", "dev").
    pub env: Option<String>,
}

/// Payload for upserting a feature flag.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpsertRequest {
    /// Target environment.
    pub env: String,
    /// Whether the flag is enabled.
    pub enabled: bool,
    /// Rollout percentage (0-100).
    pub rollout_percent: i32,
    /// Targeted organisations.
    pub target_orgs: Vec<Uuid>,
    /// Targeted users.
    pub target_users: Vec<Uuid>,
    /// Optional human description.
    pub description: Option<String>,
}

/// Response body for a delete operation.
#[derive(Serialize, ToSchema)]
pub struct DeleteResponse {
    /// Whether a row was actually deleted.
    pub deleted: bool,
}

/// List feature flags, optionally filtered by environment.
#[utoipa::path(
    get,
    path = "/api/v1/deploy/feature-flags",
    responses((status = 200, description = "List flags", body = [FeatureFlag])),
    tag = "feature-flags"
)]
#[tracing::instrument(skip(state))]
pub async fn list_flags(
    State(state): State<AppState>,
    Query(q): Query<EnvQuery>,
) -> Result<Json<Vec<FeatureFlag>>, AppError> {
    let flags = state
        .feature_flags
        .list(q.env.as_deref())
        .await
        .map_err(|e| AppError::Internal(format!("list: {e:#}")))?;
    Ok(Json(flags))
}

/// Get a single feature flag by key.
#[utoipa::path(
    get,
    path = "/api/v1/deploy/feature-flags/{key}",
    params(("key" = String, Path, description = "Flag key")),
    responses(
        (status = 200, description = "Flag details", body = FeatureFlag),
        (status = 404, description = "Flag not found"),
    ),
    tag = "feature-flags"
)]
#[tracing::instrument(skip(state))]
pub async fn get_flag(
    Path(key): Path<String>,
    State(state): State<AppState>,
    Query(q): Query<EnvQuery>,
) -> Result<Json<FeatureFlag>, AppError> {
    let env = q.env.unwrap_or_else(|| "prod".into());
    let flag = state
        .feature_flags
        .get(&key, &env)
        .await
        .map_err(|e| AppError::Internal(format!("get: {e:#}")))?
        .ok_or_else(|| AppError::NotFound(format!("flag '{key}' in env '{env}'")))?;
    Ok(Json(flag))
}

/// Upsert a feature flag (create or update by `(key, env)`).
#[utoipa::path(
    put,
    path = "/api/v1/deploy/feature-flags/{key}",
    params(("key" = String, Path, description = "Flag key")),
    request_body = UpsertRequest,
    responses((status = 200, description = "Upserted", body = FeatureFlag)),
    tag = "feature-flags"
)]
#[tracing::instrument(skip(state))]
pub async fn upsert_flag(
    Path(key): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<UpsertRequest>,
) -> Result<Json<FeatureFlag>, AppError> {
    let flag = state
        .feature_flags
        .upsert(
            &key,
            &req.env,
            req.enabled,
            req.rollout_percent,
            &req.target_orgs,
            &req.target_users,
            req.description.as_deref(),
            None,
        )
        .await
        .map_err(|e| AppError::Internal(format!("upsert: {e:#}")))?;
    Ok(Json(flag))
}

/// Delete a feature flag by `(key, env)`.
#[utoipa::path(
    delete,
    path = "/api/v1/deploy/feature-flags/{key}",
    params(("key" = String, Path, description = "Flag key")),
    responses((status = 200, description = "Deleted", body = DeleteResponse)),
    tag = "feature-flags"
)]
#[tracing::instrument(skip(state))]
pub async fn delete_flag(
    Path(key): Path<String>,
    State(state): State<AppState>,
    Query(q): Query<EnvQuery>,
) -> Result<(StatusCode, Json<DeleteResponse>), AppError> {
    let env = q.env.unwrap_or_else(|| "prod".into());
    let deleted = state
        .feature_flags
        .delete(&key, &env)
        .await
        .map_err(|e| AppError::Internal(format!("delete: {e:#}")))?;
    Ok((
        if deleted {
            StatusCode::OK
        } else {
            StatusCode::NOT_FOUND
        },
        Json(DeleteResponse { deleted }),
    ))
}

/// Build the router for feature flag CRUD endpoints.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/feature-flags", get(list_flags))
        .route(
            "/feature-flags/:key",
            get(get_flag).put(upsert_flag).delete(delete_flag),
        )
}
