//! `POST /promote` — promote last dev success to prod.

use crate::{api::state::AppState, promote};
use axum::{extract::State, response::Json, routing::post, Router};
use serde::{Deserialize, Serialize};
use signapps_common::error::Error as AppError;
use utoipa::ToSchema;

#[derive(Debug, Deserialize, ToSchema)]
pub struct PromoteRequest {
    /// Must equal `"PROMOTE TO PROD"`.
    pub confirm: String,
}

#[derive(Serialize, ToSchema)]
pub struct PromoteResponse {
    pub status: String,
}

#[utoipa::path(
    post,
    path = "/api/v1/deploy/promote",
    request_body = PromoteRequest,
    responses(
        (status = 202, description = "Promotion started", body = PromoteResponse),
        (status = 403, description = "Confirmation mismatch"),
    ),
    tag = "deploy"
)]
#[tracing::instrument(skip(_state))]
pub async fn promote(
    State(_state): State<AppState>,
    Json(req): Json<PromoteRequest>,
) -> Result<Json<PromoteResponse>, AppError> {
    if req.confirm != "PROMOTE TO PROD" {
        return Err(AppError::Forbidden("confirmation mismatch".into()));
    }
    tokio::spawn(async move {
        if let Err(e) = promote::promote_dev_to_prod().await {
            tracing::error!(error = %e, "background promote failed");
        }
    });
    Ok(Json(PromoteResponse {
        status: "started".into(),
    }))
}

/// Build the router for environment promotion endpoints.
pub fn router() -> Router<AppState> {
    Router::new().route("/promote", post(promote))
}
