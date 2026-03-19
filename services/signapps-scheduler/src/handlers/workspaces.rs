use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use signapps_common::Claims;
use uuid::Uuid;

use crate::AppState;

pub async fn list_workspaces(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    // Needs tenant context
    let tenant_id = claims.tenant_id.ok_or(StatusCode::UNAUTHORIZED)?;

    // Placeholder response
    Ok(Json(json!({
        "data": [],
        "tenant_id": tenant_id
    })))
}

pub async fn get_workspace(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let _tenant_id = claims.tenant_id.ok_or(StatusCode::UNAUTHORIZED)?;

    Ok(Json(json!({
        "id": id,
        "name": "Placeholder Workspace"
    })))
}
