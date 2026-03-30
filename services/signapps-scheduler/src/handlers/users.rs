use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use signapps_common::Claims;

use crate::AppState;

#[tracing::instrument(skip_all)]
pub async fn list_users(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let tenant_id = claims.tenant_id.ok_or(StatusCode::UNAUTHORIZED)?;

    Ok(Json(json!({
        "data": [],
        "tenant_id": tenant_id
    })))
}
