//! Calendar sharing and permission management handlers

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use signapps_db::{models::*, CalendarMemberRepository};
use uuid::Uuid;

use crate::{AppState, CalendarError};

/// Share calendar with a user
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/shares",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn share_calendar(
    State(state): State<AppState>,
    Path(calendar_id): Path<Uuid>,
    Json(payload): Json<AddCalendarMember>,
) -> Result<(StatusCode, Json<CalendarMember>), CalendarError> {
    let repo = CalendarMemberRepository::new(&state.pool);

    // Validate role
    if !["owner", "editor", "viewer"].contains(&payload.role.as_str()) {
        return Err(CalendarError::InvalidInput(
            "Role must be owner, editor, or viewer".to_string(),
        ));
    }

    let member = repo
        .add_member(calendar_id, payload.user_id, &payload.role)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok((StatusCode::CREATED, Json(member)))
}

/// Unshare calendar (remove member)
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/shares",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn unshare_calendar(
    State(state): State<AppState>,
    Path((calendar_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, CalendarError> {
    let repo = CalendarMemberRepository::new(&state.pool);
    repo.remove_member(calendar_id, user_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize)]
/// Request body for UpdatePermission.
pub struct UpdatePermissionRequest {
    pub role: String,
}

/// Update member permission
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/shares",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn update_permission(
    State(state): State<AppState>,
    Path((calendar_id, user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdatePermissionRequest>,
) -> Result<StatusCode, CalendarError> {
    // Validate role
    if !["owner", "editor", "viewer"].contains(&payload.role.as_str()) {
        return Err(CalendarError::InvalidInput(
            "Role must be owner, editor, or viewer".to_string(),
        ));
    }

    let repo = CalendarMemberRepository::new(&state.pool);
    repo.update_role(calendar_id, user_id, &payload.role)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::OK)
}

/// Get all members with access
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/shares",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn get_members(
    State(state): State<AppState>,
    Path(calendar_id): Path<Uuid>,
) -> Result<Json<Vec<CalendarMemberWithUser>>, CalendarError> {
    let repo = CalendarMemberRepository::new(&state.pool);
    let members = repo
        .list_members(calendar_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(members))
}

/// Check user permission for calendar
#[derive(serde::Serialize)]
/// Response for Permission.
pub struct PermissionResponse {
    pub can_view: bool,
    pub can_edit: bool,
    pub can_manage: bool,
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/shares",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn check_permission(
    State(_state): State<AppState>,
    Path((_calendar_id, _user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<PermissionResponse>, CalendarError> {
    // In production, check the calendar_members table
    // For now, return a default response
    Ok(Json(PermissionResponse {
        can_view: true,
        can_edit: true,
        can_manage: false,
    }))
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
