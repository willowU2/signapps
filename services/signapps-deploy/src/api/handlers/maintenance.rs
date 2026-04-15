//! `POST /envs/:env/maintenance`.

use crate::{api::state::AppState, maintenance as mx};
use axum::{
    extract::{Path, State},
    response::Json,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use signapps_common::error::Error as AppError;
use utoipa::ToSchema;

#[derive(Debug, Deserialize, ToSchema)]
pub struct MaintenanceRequest {
    pub enable: bool,
}

#[derive(Serialize, ToSchema)]
pub struct MaintenanceResponse {
    pub env: String,
    pub enabled: bool,
}

#[utoipa::path(
    post,
    path = "/api/v1/deploy/envs/{env}/maintenance",
    params(("env" = String, Path, description = "'prod' or 'dev'")),
    request_body = MaintenanceRequest,
    responses((status = 200, description = "Maintenance toggled", body = MaintenanceResponse)),
    tag = "deploy"
)]
#[tracing::instrument(skip(state))]
pub async fn toggle_maintenance(
    Path(env): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<MaintenanceRequest>,
) -> Result<Json<MaintenanceResponse>, AppError> {
    if env != "prod" && env != "dev" {
        return Err(AppError::BadRequest(format!("unknown env: {env}")));
    }
    if req.enable {
        mx::enable(&state.pool, &env)
            .await
            .map_err(|e| AppError::Internal(format!("enable: {e:#}")))?;
    } else {
        mx::disable(&state.pool, &env)
            .await
            .map_err(|e| AppError::Internal(format!("disable: {e:#}")))?;
    }
    Ok(Json(MaintenanceResponse {
        env,
        enabled: req.enable,
    }))
}

/// Build the router for maintenance mode endpoints.
pub fn router() -> Router<AppState> {
    Router::new().route("/envs/:env/maintenance", post(toggle_maintenance))
}
