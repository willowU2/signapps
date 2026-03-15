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

pub async fn list_tenants(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    // Basic verification - only admins should list all tenants
    if claims.role != 1 {
        return Err(StatusCode::FORBIDDEN);
    }
    
    // Placeholder response until SQL queries are implemented
    Ok(Json(json!({
        "data": []
    })))
}

pub async fn get_tenant(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    // Users can only view their own tenant unless they are super admins
    if claims.role != 1 && claims.tenant_id != Some(id) {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(Json(json!({
        "id": id,
        "name": "Placeholder Tenant",
        "slug": "placeholder"
    })))
}
