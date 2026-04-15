//! `POST /envs/:env/deploy`.

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
pub struct DeployRequest {
    pub version: String,
    /// Must equal `"DEPLOY PROD {version}"` for prod. Ignored on dev.
    pub confirm: String,
}

#[derive(Serialize, ToSchema)]
pub struct DeployResponse {
    pub status: String,
}

#[utoipa::path(
    post,
    path = "/api/v1/deploy/envs/{env}/deploy",
    params(("env" = String, Path, description = "'prod' or 'dev'")),
    request_body = DeployRequest,
    responses(
        (status = 202, description = "Deployment started", body = DeployResponse),
        (status = 400, description = "Invalid env"),
        (status = 403, description = "Confirmation mismatch"),
    ),
    tag = "deploy"
)]
#[tracing::instrument(skip(_state))]
pub async fn deploy(
    Path(env): Path<String>,
    State(_state): State<AppState>,
    Json(req): Json<DeployRequest>,
) -> Result<Json<DeployResponse>, AppError> {
    if env != "prod" && env != "dev" {
        return Err(AppError::BadRequest(format!("unknown env: {env}")));
    }
    if env == "prod" {
        let expected = format!("DEPLOY PROD {}", req.version);
        if req.confirm != expected {
            return Err(AppError::Forbidden(format!(
                "confirmation mismatch — expected '{expected}'"
            )));
        }
    }
    let env_clone = env.clone();
    let version = req.version.clone();
    tokio::spawn(async move {
        if let Err(e) = orchestrator::deploy(&env_clone, &version).await {
            tracing::error!(error = %e, env = %env_clone, version = %version, "background deploy failed");
        }
    });
    Ok(Json(DeployResponse {
        status: "started".into(),
    }))
}

/// Build the router for deploy mutation endpoints.
pub fn router() -> Router<AppState> {
    Router::new().route("/envs/:env/deploy", post(deploy))
}
