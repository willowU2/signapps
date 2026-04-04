//! Group Handlers
//!
//! CRUD operations for cross-functional org groups and membership management.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};
use signapps_db::models::org_audit::CreateAuditEntry;
use signapps_db::models::org_groups::{AddGroupMember, CreateOrgGroup, UpdateOrgGroup};
use signapps_db::repositories::core_org_repository::{AuditRepository, GroupRepository};

// ============================================================================
// Handlers
// ============================================================================

/// List all groups for the current tenant.
///
/// # Errors
///
/// Returns `500` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/groups",
    responses(
        (status = 200, description = "List of groups"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Groups"
)]
#[tracing::instrument(skip_all)]
pub async fn list_groups(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let groups = GroupRepository::list_groups(&state.pool, ctx.tenant_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list groups: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(json!(groups)))
}

/// Create a new org group.
///
/// # Errors
///
/// Returns `500` if the database insert fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/groups",
    request_body = CreateOrgGroup,
    responses(
        (status = 201, description = "Group created"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Groups"
)]
#[tracing::instrument(skip_all)]
pub async fn create_group(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<CreateOrgGroup>,
) -> Result<impl IntoResponse, StatusCode> {
    let group = GroupRepository::create_group(&state.pool, ctx.tenant_id, input)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create group: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Audit log
    let _ = AuditRepository::log_audit(
        &state.pool,
        CreateAuditEntry {
            tenant_id: ctx.tenant_id,
            actor_id: Some(claims.sub),
            actor_type: "user".to_string(),
            action: "create".to_string(),
            entity_type: "group".to_string(),
            entity_id: group.id,
            changes: json!({"name": group.name}),
            metadata: None,
        },
    )
    .await;

    Ok((StatusCode::CREATED, Json(json!(group))))
}

/// Get a single group by ID.
///
/// # Errors
///
/// Returns `404` if not found, `500` on database error.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/groups/{id}",
    params(("id" = Uuid, Path, description = "Group UUID")),
    responses(
        (status = 200, description = "Group found"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Group not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Groups"
)]
#[tracing::instrument(skip_all)]
pub async fn get_group(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let group = GroupRepository::get_group(&state.pool, ctx.tenant_id, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get group: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(json!(group)))
}

/// Update an existing group.
///
/// # Errors
///
/// Returns `500` if the database update fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    put,
    path = "/api/v1/workforce/groups/{id}",
    params(("id" = Uuid, Path, description = "Group UUID")),
    request_body = UpdateOrgGroup,
    responses(
        (status = 200, description = "Group updated"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Groups"
)]
#[tracing::instrument(skip_all)]
pub async fn update_group(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateOrgGroup>,
) -> Result<impl IntoResponse, StatusCode> {
    let group = GroupRepository::update_group(&state.pool, ctx.tenant_id, id, input)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update group: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let _ = AuditRepository::log_audit(
        &state.pool,
        CreateAuditEntry {
            tenant_id: ctx.tenant_id,
            actor_id: Some(claims.sub),
            actor_type: "user".to_string(),
            action: "update".to_string(),
            entity_type: "group".to_string(),
            entity_id: id,
            changes: json!({"name": group.name}),
            metadata: None,
        },
    )
    .await;

    Ok(Json(json!(group)))
}

/// Delete a group by ID.
///
/// # Errors
///
/// Returns `500` if the database delete fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    delete,
    path = "/api/v1/workforce/groups/{id}",
    params(("id" = Uuid, Path, description = "Group UUID")),
    responses(
        (status = 204, description = "Group deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Groups"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_group(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    GroupRepository::delete_group(&state.pool, ctx.tenant_id, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete group: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let _ = AuditRepository::log_audit(
        &state.pool,
        CreateAuditEntry {
            tenant_id: ctx.tenant_id,
            actor_id: Some(claims.sub),
            actor_type: "user".to_string(),
            action: "delete".to_string(),
            entity_type: "group".to_string(),
            entity_id: id,
            changes: json!({}),
            metadata: None,
        },
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

/// Add a member to a group.
///
/// # Errors
///
/// Returns `500` if the database insert fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/groups/{id}/members",
    params(("id" = Uuid, Path, description = "Group UUID")),
    request_body = AddGroupMember,
    responses(
        (status = 201, description = "Member added"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Groups"
)]
#[tracing::instrument(skip_all)]
pub async fn add_member(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
    Json(input): Json<AddGroupMember>,
) -> Result<impl IntoResponse, StatusCode> {
    let member_id = input.member_id;
    let member = GroupRepository::add_member(&state.pool, group_id, input)
        .await
        .map_err(|e| {
            tracing::error!("Failed to add member: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let _ = AuditRepository::log_audit(
        &state.pool,
        CreateAuditEntry {
            tenant_id: ctx.tenant_id,
            actor_id: Some(claims.sub),
            actor_type: "user".to_string(),
            action: "add_member".to_string(),
            entity_type: "group".to_string(),
            entity_id: group_id,
            changes: json!({"member_id": member_id}),
            metadata: None,
        },
    )
    .await;

    Ok((StatusCode::CREATED, Json(json!(member))))
}

/// Remove a member from a group.
///
/// # Errors
///
/// Returns `500` if the database delete fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    delete,
    path = "/api/v1/workforce/groups/{id}/members/{member_id}",
    params(
        ("id" = Uuid, Path, description = "Group UUID"),
        ("member_id" = Uuid, Path, description = "Member UUID"),
    ),
    responses(
        (status = 204, description = "Member removed"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Groups"
)]
#[tracing::instrument(skip_all)]
pub async fn remove_member(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Path((group_id, member_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, StatusCode> {
    GroupRepository::remove_member(&state.pool, group_id, member_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to remove member: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let _ = AuditRepository::log_audit(
        &state.pool,
        CreateAuditEntry {
            tenant_id: ctx.tenant_id,
            actor_id: Some(claims.sub),
            actor_type: "user".to_string(),
            action: "remove_member".to_string(),
            entity_type: "group".to_string(),
            entity_id: group_id,
            changes: json!({"member_id": member_id}),
            metadata: None,
        },
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

/// Get effective (resolved) members of a group via the memberof table.
///
/// # Errors
///
/// Returns `500` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/groups/{id}/effective-members",
    params(("id" = Uuid, Path, description = "Group UUID")),
    responses(
        (status = 200, description = "List of effective member person UUIDs"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Groups"
)]
#[tracing::instrument(skip_all)]
pub async fn get_effective_members(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let members = GroupRepository::list_effective_members(&state.pool, group_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get effective members: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(json!(members)))
}

/// Get all groups a person belongs to (pre-computed memberof).
///
/// # Errors
///
/// Returns `500` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/employees/{id}/memberof",
    params(("id" = Uuid, Path, description = "Person / employee UUID")),
    responses(
        (status = 200, description = "List of group memberships"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Groups"
)]
#[tracing::instrument(skip_all)]
pub async fn get_person_groups(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(person_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let groups = GroupRepository::get_person_memberof(&state.pool, person_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get person groups: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(json!(groups)))
}
