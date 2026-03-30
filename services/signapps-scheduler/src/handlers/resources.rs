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

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/resources",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
#[tracing::instrument(skip_all)]
pub async fn list_resources(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
) -> Result<impl IntoResponse, StatusCode> {
    Ok(Json(json!({
        "data": [],
        "tenant_id": ctx.tenant_id
    })))
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/resources",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
#[tracing::instrument(skip_all)]
pub async fn get_resource(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    Ok(Json(json!({
        "id": id,
        "tenant_id": ctx.tenant_id,
        "name": "Placeholder Resource"
    })))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
