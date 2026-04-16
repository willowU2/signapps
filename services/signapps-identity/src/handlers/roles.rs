//! Role management handlers (RBAC).

use crate::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use signapps_common::{Error, Result};
use signapps_db::repositories::GroupRepository;
use uuid::Uuid;

#[derive(Serialize, utoipa::ToSchema)]
/// Response for Role.
pub struct RoleResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub permissions: serde_json::Value,
    pub is_system: bool,
}

/// List all roles.
#[utoipa::path(
    get,
    path = "/api/v1/roles",
    tag = "roles",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Role list", body = Vec<RoleResponse>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list(State(state): State<AppState>) -> Result<Json<Vec<RoleResponse>>> {
    let repo = GroupRepository::new(&state.pool);
    let roles = repo.list_roles().await?;

    let response: Vec<RoleResponse> = roles
        .into_iter()
        .map(|r| RoleResponse {
            id: r.id,
            name: r.name,
            description: r.description,
            permissions: r.permissions,
            is_system: r.is_system,
        })
        .collect();

    Ok(Json(response))
}

/// Create new role.
#[utoipa::path(
    post,
    path = "/api/v1/roles",
    tag = "roles",
    security(("bearerAuth" = [])),
    request_body = signapps_db::models::CreateRole,
    responses(
        (status = 200, description = "Role created", body = RoleResponse),
        (status = 400, description = "Validation error"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create(
    State(state): State<AppState>,
    Json(payload): Json<signapps_db::models::CreateRole>,
) -> Result<Json<RoleResponse>> {
    let repo = GroupRepository::new(&state.pool);
    let role = repo.create_role(payload).await?;

    Ok(Json(RoleResponse {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        is_system: role.is_system,
    }))
}

/// Update role (non-system roles only).
#[utoipa::path(
    put,
    path = "/api/v1/roles/{id}",
    tag = "roles",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Role UUID")),
    request_body = signapps_db::models::CreateRole,
    responses(
        (status = 200, description = "Role updated", body = RoleResponse),
        (status = 400, description = "System roles cannot be modified"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Role not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn update(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<signapps_db::models::CreateRole>,
) -> Result<Json<RoleResponse>> {
    let repo = GroupRepository::new(&state.pool);
    let existing = repo
        .find_role(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Role {}", id)))?;
    if existing.is_system {
        return Err(Error::Validation(
            "System roles cannot be modified".to_string(),
        ));
    }
    let role = repo.update_role(id, payload).await?;
    Ok(Json(RoleResponse {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        is_system: role.is_system,
    }))
}

/// Delete role.
#[utoipa::path(
    delete,
    path = "/api/v1/roles/{id}",
    tag = "roles",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Role UUID")),
    responses(
        (status = 204, description = "Role deleted"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Role not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn delete(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    let repo = GroupRepository::new(&state.pool);
    repo.delete_role(id).await?;
    Ok(StatusCode::NO_CONTENT)
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
