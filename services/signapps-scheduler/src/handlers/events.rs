use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use signapps_common::{Claims, TenantContext};
use uuid::Uuid;

use crate::AppState;

pub async fn list_events(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
) -> Result<impl IntoResponse, StatusCode> {
    Ok(Json(json!({
        "data": [],
        "tenant_id": ctx.tenant_id
    })))
}

pub async fn get_event(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    Ok(Json(json!({
        "id": id,
        "tenant_id": ctx.tenant_id,
        "title": "Placeholder Event"
    })))
}
