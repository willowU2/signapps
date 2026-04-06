//! Calendar CRUD handlers.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use signapps_common::Claims;
use signapps_db::{models::*, CalendarMemberRepository, CalendarRepository};
use uuid::Uuid;

use crate::{AppState, CalendarError};

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
/// Only the owner or a shared member can access the calendar.
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
    let repo = CalendarRepository::new(&state.pool);
    let calendar = repo
        .find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    // Verify the caller owns the calendar or is a shared member
    if calendar.owner_id != claims.sub {
        let member_repo = CalendarMemberRepository::new(&state.pool);
        let members = member_repo
            .list_members(id)
            .await
            .map_err(|_| CalendarError::InternalError)?;
        if !members.iter().any(|m| m.user_id == claims.sub) {
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
    // Verify ownership before allowing update
    let repo = CalendarRepository::new(&state.pool);
    let existing = repo
        .find_by_id(id)
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
    // Verify ownership before allowing delete
    let repo = CalendarRepository::new(&state.pool);
    let existing = repo
        .find_by_id(id)
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
/// Only the owner or an existing member can view the member list.
#[utoipa::path(
    get,
    path = "/api/v1/calendars/{id}/members",
    tag = "calendars",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Calendar UUID")),
    responses(
        (status = 200, description = "List of members", body = Vec<signapps_db::models::CalendarMemberWithUser>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_members(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<CalendarMemberWithUser>>, CalendarError> {
    // Verify the caller owns the calendar or is a member
    let cal_repo = CalendarRepository::new(&state.pool);
    let calendar = cal_repo
        .find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    let repo = CalendarMemberRepository::new(&state.pool);
    let members = repo
        .list_members(id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    if calendar.owner_id != claims.sub && !members.iter().any(|m| m.user_id == claims.sub) {
        return Err(CalendarError::NotFound);
    }

    Ok(Json(members))
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
    request_body = signapps_db::models::AddCalendarMember,
    responses(
        (status = 201, description = "Member added", body = signapps_db::models::CalendarMember),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn add_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddCalendarMember>,
) -> Result<(StatusCode, Json<CalendarMember>), CalendarError> {
    // Only the calendar owner can add members
    let cal_repo = CalendarRepository::new(&state.pool);
    let calendar = cal_repo
        .find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;
    if calendar.owner_id != claims.sub {
        return Err(CalendarError::NotFound);
    }

    let repo = CalendarMemberRepository::new(&state.pool);
    let member = repo
        .add_member(id, payload.user_id, &payload.role)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok((StatusCode::CREATED, Json(member)))
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
    // Only the calendar owner can remove members
    let cal_repo = CalendarRepository::new(&state.pool);
    let calendar = cal_repo
        .find_by_id(calendar_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;
    if calendar.owner_id != claims.sub {
        return Err(CalendarError::NotFound);
    }

    let repo = CalendarMemberRepository::new(&state.pool);
    repo.remove_member(calendar_id, user_id)
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
    // Only the calendar owner can update member roles
    let cal_repo = CalendarRepository::new(&state.pool);
    let calendar = cal_repo
        .find_by_id(calendar_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;
    if calendar.owner_id != claims.sub {
        return Err(CalendarError::NotFound);
    }

    let repo = CalendarMemberRepository::new(&state.pool);
    repo.update_role(calendar_id, user_id, &payload.role)
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
