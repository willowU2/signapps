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

/// List workspaces for the current tenant.
#[utoipa::path(
    get,
    path = "/api/v1/workspaces",
    responses(
        (status = 200, description = "List of workspaces"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Workspaces"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
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

/// Get a workspace by ID.
#[utoipa::path(
    get,
    path = "/api/v1/workspaces/{id}",
    params(("id" = Uuid, Path, description = "Workspace ID")),
    responses(
        (status = 200, description = "Workspace details"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Workspaces"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
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
