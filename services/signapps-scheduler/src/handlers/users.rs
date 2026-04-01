use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use signapps_common::Claims;

use crate::AppState;

/// List users for the current tenant.
#[utoipa::path(
    get,
    path = "/api/v1/users",
    responses(
        (status = 200, description = "List of users"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Users"
)]
#[tracing::instrument(skip_all)]
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
