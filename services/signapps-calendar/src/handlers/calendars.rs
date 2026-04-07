//! Calendar CRUD handlers.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use signapps_common::auth::Claims;
use signapps_db::{models::*, CalendarRepository};
use signapps_sharing::models::CreateGrant;
use signapps_sharing::types::{GranteeType, ResourceRef, ResourceType};
use uuid::Uuid;

use crate::handlers::shares::CalendarShareEntry;
use crate::{AppState, CalendarError};

/// Request body to add a member to a calendar.
#[derive(Debug, serde::Deserialize, utoipa::ToSchema)]
pub struct AddMemberRequest {
    pub user_id: Uuid,
    pub role: String,
}

#[derive(Debug, Deserialize)]
/// Request body for UpdateRole.
pub struct UpdateRoleRequest {
    pub role: String,
}

/// Create a new calendar.
#[utoipa::path(
    post,
    path = "/api/v1/calendars",
    tag = "calendars",
    security(("bearerAuth" = [])),
    request_body = signapps_db::models::CreateCalendar,
    responses(
        (status = 201, description = "Calendar created", body = signapps_db::models::Calendar),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create_calendar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateCalendar>,
) -> Result<(StatusCode, Json<Calendar>), CalendarError> {
    let repo = CalendarRepository::new(&state.pool);
    let calendar = repo
        .create(payload, claims.sub)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok((StatusCode::CREATED, Json(calendar)))
}

/// Get all calendars for current user (owned + shared).
#[utoipa::path(
    get,
    path = "/api/v1/calendars",
    tag = "calendars",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of calendars", body = Vec<signapps_db::models::Calendar>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_calendars(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Calendar>>, CalendarError> {
    let repo = CalendarRepository::new(&state.pool);
    let calendars = repo
        .list_for_user(claims.sub)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(calendars))
}

/// Get calendar by ID.
///
/// Only the owner or a user with a sharing grant can access the calendar.
#[utoipa::path(
    get,
    path = "/api/v1/calendars/{id}",
    tag = "calendars",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Calendar UUID")),
    responses(
        (status = 200, description = "Calendar found", body = signapps_db::models::Calendar),
        (status = 404, description = "Calendar not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_calendar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Calendar>, CalendarError> {
    let tenant_id = claims.tenant_id.ok_or(CalendarError::Unauthorized)?;
    let repo = CalendarRepository::new(&state.pool);
    let calendar = repo
        .find_by_id(id, tenant_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    // Verify the caller owns the calendar or has a sharing grant
    if calendar.owner_id != claims.sub {
        let user_ctx = state
            .sharing
            .build_user_context(&claims)
            .await
            .map_err(|_| CalendarError::InternalError)?;

        let resource = ResourceRef {
            resource_type: ResourceType::Calendar,
            resource_id: id,
        };

        let effective = state
            .sharing
            .effective_role(&user_ctx, resource, Some(calendar.owner_id))
            .await
            .map_err(|_| CalendarError::InternalError)?;

        if effective.is_none() {
            return Err(CalendarError::NotFound);
        }
    }

    Ok(Json(calendar))
}

/// Update a calendar.
///
/// Only the calendar owner can update it.
#[utoipa::path(
    put,
    path = "/api/v1/calendars/{id}",
    tag = "calendars",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Calendar UUID")),
    request_body = signapps_db::models::UpdateCalendar,
    responses(
        (status = 200, description = "Calendar updated", body = signapps_db::models::Calendar),
        (status = 404, description = "Calendar not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn update_calendar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCalendar>,
) -> Result<Json<Calendar>, CalendarError> {
    let tenant_id = claims.tenant_id.ok_or(CalendarError::Unauthorized)?;
    // Verify ownership before allowing update
    let repo = CalendarRepository::new(&state.pool);
    let existing = repo
        .find_by_id(id, tenant_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;
    if existing.owner_id != claims.sub {
        return Err(CalendarError::NotFound);
    }

    let calendar = repo
        .update(id, payload)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(calendar))
}

/// Delete a calendar.
///
/// Only the calendar owner can delete it.
#[utoipa::path(
    delete,
    path = "/api/v1/calendars/{id}",
    tag = "calendars",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Calendar UUID")),
    responses(
        (status = 204, description = "Calendar deleted"),
        (status = 404, description = "Calendar not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn delete_calendar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, CalendarError> {
    let tenant_id = claims.tenant_id.ok_or(CalendarError::Unauthorized)?;
    // Verify ownership before allowing delete
    let repo = CalendarRepository::new(&state.pool);
    let existing = repo
        .find_by_id(id, tenant_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;
    if existing.owner_id != claims.sub {
        return Err(CalendarError::NotFound);
    }

    repo.delete(id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::NO_CONTENT)
}

/// Get all members of a calendar.
///
/// Returns all sharing grants for the calendar. Only the owner or an existing
/// member can view the grant list.
#[utoipa::path(
    get,
    path = "/api/v1/calendars/{id}/members",
    tag = "calendars",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Calendar UUID")),
    responses(
        (status = 200, description = "List of members", body = Vec<CalendarShareEntry>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_members(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<CalendarShareEntry>>, CalendarError> {
    let tenant_id = claims.tenant_id.ok_or(CalendarError::Unauthorized)?;
    // Verify the calendar exists first
    let cal_repo = CalendarRepository::new(&state.pool);
    let calendar = cal_repo
        .find_by_id(id, tenant_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    let user_ctx = state
        .sharing
        .build_user_context(&claims)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let resource = ResourceRef {
        resource_type: ResourceType::Calendar,
        resource_id: id,
    };

    // Only owner or a user with a grant can see the member list
    if calendar.owner_id != claims.sub {
        let effective = state
            .sharing
            .effective_role(&user_ctx, resource.clone(), Some(calendar.owner_id))
            .await
            .map_err(|_| CalendarError::InternalError)?;
        if effective.is_none() {
            return Err(CalendarError::NotFound);
        }
    }

    let grants = state
        .sharing
        .list_grants(&user_ctx, resource)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let entries: Vec<CalendarShareEntry> = grants.iter().map(CalendarShareEntry::from).collect();

    Ok(Json(entries))
}

/// Add a member to a calendar (share).
///
/// Only the calendar owner can add members.
#[utoipa::path(
    post,
    path = "/api/v1/calendars/{id}/members",
    tag = "calendars",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Calendar UUID")),
    request_body = AddMemberRequest,
    responses(
        (status = 201, description = "Member added", body = CalendarShareEntry),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn add_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddMemberRequest>,
) -> Result<(StatusCode, Json<CalendarShareEntry>), CalendarError> {
    let tenant_id = claims.tenant_id.ok_or(CalendarError::Unauthorized)?;
    // Only the calendar owner can add members
    let cal_repo = CalendarRepository::new(&state.pool);
    let calendar = cal_repo
        .find_by_id(id, tenant_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;
    if calendar.owner_id != claims.sub {
        return Err(CalendarError::NotFound);
    }

    let actor_ctx = state
        .sharing
        .build_user_context(&claims)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let resource = ResourceRef {
        resource_type: ResourceType::Calendar,
        resource_id: id,
    };

    let role = crate::handlers::shares::map_legacy_role_pub(&payload.role);
    let grant_req = CreateGrant {
        grantee_type: GranteeType::User,
        grantee_id: Some(payload.user_id),
        role,
        can_reshare: None,
        expires_at: None,
    };

    let grant = state
        .sharing
        .grant(&actor_ctx, resource, None, grant_req)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok((StatusCode::CREATED, Json(CalendarShareEntry::from(&grant))))
}

/// Remove a member from a calendar.
///
/// Only the calendar owner can remove members.
#[utoipa::path(
    delete,
    path = "/api/v1/calendars/{calendar_id}/members/{user_id}",
    tag = "calendars",
    security(("bearerAuth" = [])),
    params(
        ("calendar_id" = Uuid, Path, description = "Calendar UUID"),
        ("user_id" = Uuid, Path, description = "User UUID"),
    ),
    responses(
        (status = 204, description = "Member removed"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn remove_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((calendar_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, CalendarError> {
    let tenant_id = claims.tenant_id.ok_or(CalendarError::Unauthorized)?;
    // Only the calendar owner can remove members
    let cal_repo = CalendarRepository::new(&state.pool);
    let calendar = cal_repo
        .find_by_id(calendar_id, tenant_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;
    if calendar.owner_id != claims.sub {
        return Err(CalendarError::NotFound);
    }

    let actor_ctx = state
        .sharing
        .build_user_context(&claims)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let resource = ResourceRef {
        resource_type: ResourceType::Calendar,
        resource_id: calendar_id,
    };

    // Find the grant for this specific user
    let grants = state
        .sharing
        .list_grants(&actor_ctx, resource.clone())
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let grant = grants
        .iter()
        .find(|g| g.grantee_id == Some(user_id))
        .ok_or(CalendarError::NotFound)?;

    state
        .sharing
        .revoke(&actor_ctx, resource, None, grant.id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::NO_CONTENT)
}

/// Update member role.
///
/// Only the calendar owner can update member roles.
#[tracing::instrument(skip_all)]
pub async fn update_member_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((calendar_id, user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateRoleRequest>,
) -> Result<StatusCode, CalendarError> {
    let tenant_id = claims.tenant_id.ok_or(CalendarError::Unauthorized)?;
    // Only the calendar owner can update member roles
    let cal_repo = CalendarRepository::new(&state.pool);
    let calendar = cal_repo
        .find_by_id(calendar_id, tenant_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;
    if calendar.owner_id != claims.sub {
        return Err(CalendarError::NotFound);
    }

    let actor_ctx = state
        .sharing
        .build_user_context(&claims)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let resource = ResourceRef {
        resource_type: ResourceType::Calendar,
        resource_id: calendar_id,
    };

    // Find the existing grant for this user
    let grants = state
        .sharing
        .list_grants(&actor_ctx, resource.clone())
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let existing = grants
        .iter()
        .find(|g| g.grantee_id == Some(user_id))
        .ok_or(CalendarError::NotFound)?;

    let old_grant_id = existing.id;
    let old_expires_at = existing.expires_at;
    let old_can_reshare = existing.can_reshare;

    // Revoke old grant
    state
        .sharing
        .revoke(&actor_ctx, resource.clone(), None, old_grant_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    // Re-create with new role
    let new_role = crate::handlers::shares::map_legacy_role_pub(&payload.role);
    let grant_req = CreateGrant {
        grantee_type: GranteeType::User,
        grantee_id: Some(user_id),
        role: new_role,
        can_reshare: old_can_reshare,
        expires_at: old_expires_at,
    };

    state
        .sharing
        .grant(&actor_ctx, resource, None, grant_req)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::OK)
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
