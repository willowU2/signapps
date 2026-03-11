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
pub struct UpdateRoleRequest {
    pub role: String,
}

/// Create a new calendar.
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
pub async fn get_calendar(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Calendar>, CalendarError> {
    let repo = CalendarRepository::new(&state.pool);
    let calendar = repo
        .find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    Ok(Json(calendar))
}

/// Update a calendar.
pub async fn update_calendar(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCalendar>,
) -> Result<Json<Calendar>, CalendarError> {
    let repo = CalendarRepository::new(&state.pool);
    let calendar = repo
        .update(id, payload)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(calendar))
}

/// Delete a calendar.
pub async fn delete_calendar(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, CalendarError> {
    let repo = CalendarRepository::new(&state.pool);
    repo.delete(id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::NO_CONTENT)
}

/// Get all members of a calendar.
pub async fn list_members(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<CalendarMemberWithUser>>, CalendarError> {
    let repo = CalendarMemberRepository::new(&state.pool);
    let members = repo
        .list_members(id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(members))
}

/// Add a member to a calendar (share).
pub async fn add_member(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddCalendarMember>,
) -> Result<(StatusCode, Json<CalendarMember>), CalendarError> {
    let repo = CalendarMemberRepository::new(&state.pool);
    let member = repo
        .add_member(id, payload.user_id, &payload.role)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok((StatusCode::CREATED, Json(member)))
}

/// Remove a member from a calendar.
pub async fn remove_member(
    State(state): State<AppState>,
    Path((calendar_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, CalendarError> {
    let repo = CalendarMemberRepository::new(&state.pool);
    repo.remove_member(calendar_id, user_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::NO_CONTENT)
}

/// Update member role.
pub async fn update_member_role(
    State(state): State<AppState>,
    Path((calendar_id, user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateRoleRequest>,
) -> Result<StatusCode, CalendarError> {
    let repo = CalendarMemberRepository::new(&state.pool);
    repo.update_role(calendar_id, user_id, &payload.role)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::OK)
}
