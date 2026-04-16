use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use signapps_common::Claims;
use signapps_db::repositories::TenantRepository;
use uuid::Uuid;

use crate::AppState;

/// List all tenants (super-admin only).
#[utoipa::path(
    get,
    path = "/api/v1/tenants",
    responses(
        (status = 200, description = "List of tenants"),
        (status = 403, description = "Forbidden"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Tenants"
)]
#[tracing::instrument(skip_all)]
pub async fn list_tenants(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    // Only super-admins (role == 1) may list all tenants.
    if claims.role != 1 {
        return Err(StatusCode::FORBIDDEN);
    }

    let tenants = TenantRepository::list(&state.pool, 100, 0)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list tenants: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(json!({ "data": tenants })))
}

/// Get a tenant by ID.
#[utoipa::path(
    get,
    path = "/api/v1/tenants/{id}",
    params(("id" = Uuid, Path, description = "Tenant ID")),
    responses(
        (status = 200, description = "Tenant details"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Tenants"
)]
#[tracing::instrument(skip_all)]
pub async fn get_tenant(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    // Users can only view their own tenant unless they are super-admins.
    if claims.role != 1 && claims.tenant_id != Some(id) {
        return Err(StatusCode::FORBIDDEN);
    }

    let tenant = TenantRepository::find_by_id(&state.pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get tenant {}: {}", id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(json!({
        "id": tenant.id,
        "name": tenant.name,
        "slug": tenant.slug,
        "domain": tenant.domain,
        "plan": tenant.plan,
        "is_active": tenant.is_active,
        "created_at": tenant.created_at,
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
