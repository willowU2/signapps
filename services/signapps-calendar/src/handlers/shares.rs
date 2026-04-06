//! Calendar sharing and permission management handlers — backed by the unified
//! `signapps-sharing` engine.
//!
//! The legacy 3-role scheme used in the old `calendar.calendar_members` table
//! is silently mapped to the sharing engine's 3-role scheme:
//!
//! | Legacy  | Sharing engine |
//! |---------|----------------|
//! | owner   | manager        |
//! | editor  | editor         |
//! | viewer  | viewer         |

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::auth::Claims;
use signapps_sharing::models::{CreateGrant, Grant};
use signapps_sharing::types::{GranteeType, ResourceRef, ResourceType, Role};
use uuid::Uuid;

use crate::{AppState, CalendarError};

// ============================================================================
// Role mapping helpers
// ============================================================================

/// Map a legacy calendar role string to the sharing engine [`Role`].
///
/// - `"owner"` → [`Role::Manager`]
/// - `"editor"` → [`Role::Editor`]
/// - `"viewer"` (or anything else) → [`Role::Viewer`]
fn map_legacy_role(role: &str) -> Role {
    map_legacy_role_pub(role)
}

/// Public alias of [`map_legacy_role`] for use by sibling handler modules.
pub fn map_legacy_role_pub(role: &str) -> Role {
    match role {
        "owner" | "manager" => Role::Manager,
        "editor" => Role::Editor,
        _ => Role::Viewer,
    }
}

/// Convert a sharing engine [`Role`] back to a legacy calendar role string.
fn role_to_legacy(role: &Role) -> &'static str {
    match role {
        Role::Manager => "owner",
        Role::Editor => "editor",
        Role::Viewer | Role::Deny => "viewer",
    }
}

// ============================================================================
// Request / response DTOs
// ============================================================================

/// Request body to share a calendar with a user.
#[derive(Debug, Deserialize)]
pub struct ShareCalendarRequest {
    /// UUID of the user to share with.
    pub user_id: Uuid,
    /// Legacy role: `"owner"`, `"editor"`, or `"viewer"`.
    pub role: String,
    /// Optional expiry for time-limited shares.
    pub expires_at: Option<DateTime<Utc>>,
}

/// Request body to update a share's role.
#[derive(Debug, Deserialize)]
pub struct UpdatePermissionRequest {
    /// New role: `"owner"`, `"editor"`, or `"viewer"`.
    pub role: String,
}

/// A calendar share entry in the legacy response shape.
///
/// Mirrors the old `CalendarMember` response so existing API consumers
/// continue to work without changes.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct CalendarShareEntry {
    /// Grant ID (replaces the old `calendar_members.id`).
    pub id: Uuid,
    /// UUID of the user who was granted access.
    pub user_id: Option<Uuid>,
    /// Legacy role string (`"owner"`, `"editor"`, `"viewer"`).
    pub role: String,
    /// Grantee kind (`"user"`, `"group"`, `"everyone"`, …).
    pub grantee_type: String,
    /// Expiry timestamp, if any.
    pub expires_at: Option<DateTime<Utc>>,
}

impl From<&Grant> for CalendarShareEntry {
    fn from(g: &Grant) -> Self {
        let legacy_role = g
            .parsed_role()
            .map(|r| role_to_legacy(&r).to_owned())
            .unwrap_or_else(|| "viewer".to_owned());

        Self {
            id: g.id,
            user_id: g.grantee_id,
            role: legacy_role,
            grantee_type: g.grantee_type.clone(),
            expires_at: g.expires_at,
        }
    }
}

/// Response for the `check_permission` endpoint.
#[derive(Debug, Serialize)]
pub struct PermissionResponse {
    pub can_view: bool,
    pub can_edit: bool,
    pub can_manage: bool,
}

// ============================================================================
// Handlers
// ============================================================================

/// POST /api/v1/calendars/:calendar_id/shares
///
/// Share a calendar with a user.
#[tracing::instrument(skip_all, fields(calendar_id = %calendar_id))]
pub async fn share_calendar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(calendar_id): Path<Uuid>,
    Json(payload): Json<ShareCalendarRequest>,
) -> Result<(StatusCode, Json<CalendarShareEntry>), CalendarError> {
    let actor_ctx = state
        .sharing
        .build_user_context(&claims)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let resource = ResourceRef {
        resource_type: ResourceType::Calendar,
        resource_id: calendar_id,
    };

    let role = map_legacy_role(&payload.role);

    let grant_req = CreateGrant {
        grantee_type: GranteeType::User,
        grantee_id: Some(payload.user_id),
        role,
        can_reshare: None,
        expires_at: payload.expires_at,
    };

    let grant = state
        .sharing
        .grant(&actor_ctx, resource, None, grant_req)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok((StatusCode::CREATED, Json(CalendarShareEntry::from(&grant))))
}

/// DELETE /api/v1/calendars/:calendar_id/shares/:user_id
///
/// Revoke calendar access for a specific user (by looking up their grant).
#[tracing::instrument(skip_all, fields(calendar_id = %calendar_id, user_id = %user_id))]
pub async fn unshare_calendar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((calendar_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, CalendarError> {
    let actor_ctx = state
        .sharing
        .build_user_context(&claims)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let resource = ResourceRef {
        resource_type: ResourceType::Calendar,
        resource_id: calendar_id,
    };

    // List grants and find the one belonging to this user
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

/// PUT /api/v1/calendars/:calendar_id/shares/:user_id
///
/// Update the role of an existing calendar share for a user.
#[tracing::instrument(skip_all, fields(calendar_id = %calendar_id, user_id = %user_id))]
pub async fn update_permission(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((calendar_id, user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdatePermissionRequest>,
) -> Result<StatusCode, CalendarError> {
    let actor_ctx = state
        .sharing
        .build_user_context(&claims)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let resource = ResourceRef {
        resource_type: ResourceType::Calendar,
        resource_id: calendar_id,
    };

    // Find existing grant for this user
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

    // Create replacement grant with the new role
    let new_role = map_legacy_role(&payload.role);
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

/// GET /api/v1/calendars/:calendar_id/shares
///
/// List all shares (grants) for this calendar.
#[tracing::instrument(skip_all, fields(calendar_id = %calendar_id))]
pub async fn get_members(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(calendar_id): Path<Uuid>,
) -> Result<Json<Vec<CalendarShareEntry>>, CalendarError> {
    let user_ctx = state
        .sharing
        .build_user_context(&claims)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let resource = ResourceRef {
        resource_type: ResourceType::Calendar,
        resource_id: calendar_id,
    };

    let grants = state
        .sharing
        .list_grants(&user_ctx, resource)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let entries: Vec<CalendarShareEntry> = grants.iter().map(CalendarShareEntry::from).collect();

    Ok(Json(entries))
}

/// GET /api/v1/calendars/:calendar_id/shares/:user_id/check
///
/// Check the effective permission of a specific user on this calendar.
#[tracing::instrument(skip_all, fields(calendar_id = %calendar_id, user_id = %user_id))]
pub async fn check_permission(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((calendar_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<PermissionResponse>, CalendarError> {
    // Build context for the user whose permission we're checking — but we
    // only have the JWT claims for the *caller*, not for user_id.  We resolve
    // the effective role for the caller when user_id == claims.sub, otherwise
    // we list grants and look up the user's grant directly.
    let actor_ctx = state
        .sharing
        .build_user_context(&claims)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let resource = ResourceRef {
        resource_type: ResourceType::Calendar,
        resource_id: calendar_id,
    };

    let (can_view, can_edit, can_manage) = if user_id == claims.sub {
        // Resolve the caller's own effective permission
        let effective = state
            .sharing
            .effective_role(&actor_ctx, resource, None)
            .await
            .map_err(|_| CalendarError::InternalError)?;

        match effective.as_ref().map(|e| &e.role) {
            Some(Role::Manager) => (true, true, true),
            Some(Role::Editor) => (true, true, false),
            Some(Role::Viewer) => (true, false, false),
            _ => (false, false, false),
        }
    } else {
        // Look up the target user's grant directly from the grants list
        let grants = state
            .sharing
            .list_grants(&actor_ctx, resource)
            .await
            .map_err(|_| CalendarError::InternalError)?;

        let maybe_role = grants
            .iter()
            .find(|g| g.grantee_id == Some(user_id))
            .and_then(|g| g.parsed_role());

        match maybe_role {
            Some(Role::Manager) => (true, true, true),
            Some(Role::Editor) => (true, true, false),
            Some(Role::Viewer) => (true, false, false),
            _ => (false, false, false),
        }
    };

    Ok(Json(PermissionResponse { can_view, can_edit, can_manage }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_role_owner_maps_to_manager() {
        assert_eq!(map_legacy_role("owner"), Role::Manager);
    }

    #[test]
    fn legacy_role_editor_maps_to_editor() {
        assert_eq!(map_legacy_role("editor"), Role::Editor);
    }

    #[test]
    fn legacy_role_viewer_maps_to_viewer() {
        assert_eq!(map_legacy_role("viewer"), Role::Viewer);
    }

    #[test]
    fn legacy_role_unknown_maps_to_viewer() {
        assert_eq!(map_legacy_role("unknown"), Role::Viewer);
    }

    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
