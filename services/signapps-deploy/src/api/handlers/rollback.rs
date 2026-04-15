//! `POST /envs/:env/rollback`.

use crate::{api::state::AppState, orchestrator};
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
pub struct RollbackRequest {
    /// Must equal `"ROLLBACK PROD"` on prod. Ignored on dev.
    pub confirm: String,
}

#[derive(Serialize, ToSchema)]
pub struct RollbackResponse {
    pub status: String,
}

#[utoipa::path(
    post,
    path = "/api/v1/deploy/envs/{env}/rollback",
    params(("env" = String, Path, description = "'prod' or 'dev'")),
    request_body = RollbackRequest,
    responses(
        (status = 202, description = "Rollback started", body = RollbackResponse),
        (status = 400, description = "Invalid env"),
        (status = 403, description = "Confirmation mismatch"),
    ),
    tag = "deploy"
)]
#[tracing::instrument(skip(_state))]
pub async fn rollback(
    Path(env): Path<String>,
    State(_state): State<AppState>,
    Json(req): Json<RollbackRequest>,
) -> Result<Json<RollbackResponse>, AppError> {
    if env != "prod" && env != "dev" {
        return Err(AppError::BadRequest(format!("unknown env: {env}")));
    }
    if env == "prod" && req.confirm != "ROLLBACK PROD" {
        return Err(AppError::Forbidden("confirmation mismatch".into()));
    }
    let env_clone = env.clone();
    tokio::spawn(async move {
        if let Err(e) = orchestrator::rollback(&env_clone).await {
            tracing::error!(error = %e, env = %env_clone, "background rollback failed");
        }
    });
    Ok(Json(RollbackResponse {
        status: "started".into(),
    }))
}

/// Build the router for rollback endpoints.
pub fn router() -> Router<AppState> {
    Router::new().route("/envs/:env/rollback", post(rollback))
}
