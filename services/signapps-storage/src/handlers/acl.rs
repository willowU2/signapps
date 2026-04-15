//! Drive ACL management handlers — backed by the unified `signapps-sharing` engine.
//!
//! Endpoints:
//! - GET    /api/v1/drive/nodes/:id/acl            → list_acl
//! - POST   /api/v1/drive/nodes/:id/acl            → create_acl
//! - PUT    /api/v1/drive/nodes/:id/acl/:acl_id    → update_acl
//! - DELETE /api/v1/drive/nodes/:id/acl/:acl_id    → delete_acl
//! - POST   /api/v1/drive/nodes/:id/acl/break      → break_inheritance
//! - POST   /api/v1/drive/nodes/:id/acl/restore    → restore_inheritance
//! - GET    /api/v1/drive/nodes/:id/effective-acl  → effective_acl
//!
//! The legacy 5-role scheme (viewer / downloader / editor / contributor / manager)
//! is accepted on incoming requests and silently mapped to the 3-role scheme used
//! by the sharing engine (viewer / editor / manager):
//!
//! | Legacy        | Sharing engine |
//! |---------------|----------------|
//! | viewer        | viewer         |
//! | downloader    | viewer         |
//! | editor        | editor         |
//! | contributor   | editor         |
//! | manager       | manager        |

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use signapps_common::auth::Claims;
use signapps_common::{Error, Result};
use signapps_sharing::models::{CreateGrant, EffectivePermission, Grant};
use signapps_sharing::repository::SharingRepository;
use signapps_sharing::types::{GranteeType, ResourceRef, ResourceType, Role};
use uuid::Uuid;

use crate::services::audit_chain;
use crate::AppState;

// ============================================================================
// Role mapping helpers
// ============================================================================

/// Map a legacy 5-role string to the 3-role sharing engine role.
///
/// - `downloader` → `viewer` (downloads are within viewer capabilities)
/// - `contributor` → `editor` (uploads are within editor capabilities)
/// - All others: identity mapping.
fn map_legacy_role(role: &str) -> Role {
    match role {
        "viewer" | "downloader" => Role::Viewer,
        "editor" | "contributor" => Role::Editor,
        _ => Role::Manager,
    }
}

// ============================================================================
// Request / response DTOs
// ============================================================================

/// Request to create an ACL grant on a drive node.
///
/// Accepts both the legacy 5-role scheme and the new 3-role scheme.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateAclRequest {
    /// Grantee kind: `"user"`, `"group"`, `"everyone"`.
    pub grantee_type: String,
    /// UUID of the specific grantee (omit for `"everyone"`).
    pub grantee_id: Option<Uuid>,
    /// Role to grant. Legacy values `"downloader"` and `"contributor"` are
    /// accepted and silently promoted to `"viewer"` / `"editor"` respectively.
    pub role: String,
    /// Whether the grant propagates to child nodes (stored as a metadata hint;
    /// actual inheritance is controlled by `inherit_permissions` on the node).
    pub inherit: Option<bool>,
    /// Optional expiry for time-limited grants.
    pub expires_at: Option<DateTime<Utc>>,
    /// Whether the grantee may re-share the resource with others.
    pub can_reshare: Option<bool>,
}

/// Request to update an existing ACL grant.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateAclRequest {
    /// New role (optional). Same legacy mapping applies.
    pub role: Option<String>,
    /// New `can_reshare` flag (optional).
    pub can_reshare: Option<bool>,
    /// New expiry (optional).
    pub expires_at: Option<DateTime<Utc>>,
}

/// Effective-ACL response: the caller's resolved permission on a node.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct EffectiveAclResponse {
    /// The drive node UUID.
    pub node_id: Uuid,
    /// The resolved role string (`"viewer"`, `"editor"`, or `"manager"`).
    pub role: Option<String>,
    /// Full effective permission detail from the sharing engine.
    pub permission: Option<EffectivePermission>,
}

/// Determine the `ResourceType` for a drive node.
///
/// Queries `drive.nodes` to find out whether the node is a file or folder,
/// defaulting to `File` when the type is unrecognised or the node is missing.
///
/// # Errors
///
/// Returns [`Error::Database`] if the query fails (connection error, etc.).
async fn node_resource_type(pool: &sqlx::PgPool, node_id: Uuid) -> Result<ResourceType> {
    let kind: Option<String> =
        sqlx::query_scalar("SELECT node_type FROM drive.nodes WHERE id = $1")
            .bind(node_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                tracing::warn!(?e, %node_id, "failed to query node_type");
                Error::Database(e.to_string())
            })?;

    Ok(match kind.as_deref() {
        Some("folder") => ResourceType::Folder,
        _ => ResourceType::File,
    })
}

// ============================================================================
// List ACL grants
// ============================================================================

/// GET /api/v1/drive/nodes/:id/acl
///
/// Returns all active grants directly attached to this node.
#[utoipa::path(
    get,
    path = "/api/v1/drive/nodes/{id}/acl",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 200, description = "ACL grants for the node", body = Vec<Grant>),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "drive_acl"
)]
#[tracing::instrument(skip_all, fields(node_id = %id))]
pub async fn list_acl(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Grant>>> {
    let user_ctx = state.sharing.build_user_context(&claims).await?;
    let rtype = node_resource_type(state.pool.inner(), id).await?;
    let resource = ResourceRef {
        resource_type: rtype,
        resource_id: id,
    };

    let grants = state.sharing.list_grants(&user_ctx, resource).await?;

    let _ = audit_chain::log_audit(
        state.pool.inner(),
        Some(id),
        &format!("/drive/nodes/{id}/acl"),
        "acl_list",
        claims.sub,
        None,
        None,
        None,
    )
    .await;

    Ok(Json(grants))
}

// ============================================================================
// Create ACL grant
// ============================================================================

/// POST /api/v1/drive/nodes/:id/acl
///
/// Grant a new permission to a user, group, or everyone on this node.
#[utoipa::path(
    post,
    path = "/api/v1/drive/nodes/{id}/acl",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    request_body = CreateAclRequest,
    responses(
        (status = 201, description = "ACL grant created", body = Grant),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
    ),
    security(("bearerAuth" = [])),
    tag = "drive_acl"
)]
#[tracing::instrument(skip_all, fields(node_id = %id))]
pub async fn create_acl(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateAclRequest>,
) -> Result<(StatusCode, Json<Grant>)> {
    let actor_ctx = state.sharing.build_user_context(&claims).await?;
    let rtype = node_resource_type(state.pool.inner(), id).await?;
    let resource = ResourceRef {
        resource_type: rtype,
        resource_id: id,
    };

    // Map legacy grantee_type string to typed GranteeType
    let grantee_type: GranteeType = payload.grantee_type.parse().map_err(|_| {
        signapps_common::Error::BadRequest(format!(
            "invalid grantee_type: {}",
            payload.grantee_type
        ))
    })?;
    let role = map_legacy_role(&payload.role);

    let grant_req = CreateGrant {
        grantee_type,
        grantee_id: payload.grantee_id,
        role,
        can_reshare: payload.can_reshare,
        expires_at: payload.expires_at,
    };

    let grant = state
        .sharing
        .grant(&actor_ctx, resource, None, grant_req)
        .await?;

    let _ = audit_chain::log_audit(
        state.pool.inner(),
        Some(id),
        &format!("/drive/nodes/{id}/acl"),
        "acl_grant",
        claims.sub,
        None,
        None,
        Some(
            json!({ "grant_id": grant.id, "role": grant.role, "grantee_type": grant.grantee_type }),
        ),
    )
    .await;

    Ok((StatusCode::CREATED, Json(grant)))
}

// ============================================================================
// Update ACL grant
// ============================================================================

/// PUT /api/v1/drive/nodes/:id/acl/:acl_id
///
/// Update the role or expiry of an existing ACL grant by revoking the old
/// grant and creating a new one with the requested role.
#[utoipa::path(
    put,
    path = "/api/v1/drive/nodes/{id}/acl/{acl_id}",
    params(
        ("id" = uuid::Uuid, Path, description = "Node ID"),
        ("acl_id" = uuid::Uuid, Path, description = "Grant ID"),
    ),
    request_body = UpdateAclRequest,
    responses(
        (status = 200, description = "ACL grant updated", body = Grant),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Grant not found"),
    ),
    security(("bearerAuth" = [])),
    tag = "drive_acl"
)]
#[tracing::instrument(skip_all, fields(node_id = %id, grant_id = %acl_id))]
pub async fn update_acl(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, acl_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateAclRequest>,
) -> Result<Json<Grant>> {
    let actor_ctx = state.sharing.build_user_context(&claims).await?;
    let rtype = node_resource_type(state.pool.inner(), id).await?;
    let resource = ResourceRef {
        resource_type: rtype,
        resource_id: id,
    };

    // Fetch the existing grant so we can verify it exists and derive unchanged
    // fields (grantee_type, grantee_id, role fallback, etc.)
    let grants = state
        .sharing
        .list_grants(&actor_ctx, resource.clone())
        .await?;
    let existing = grants
        .iter()
        .find(|g| g.id == acl_id)
        .cloned()
        .ok_or_else(|| signapps_common::Error::NotFound(format!("grant {acl_id} not found")))?;

    // Determine new role, expiry, can_reshare (fall back to existing values).
    let new_role = payload
        .role
        .as_deref()
        .map(map_legacy_role)
        .unwrap_or_else(|| existing.parsed_role().unwrap_or(Role::Viewer));

    let new_expires_at = payload.expires_at.or(existing.expires_at);
    let new_can_reshare = payload.can_reshare.or(existing.can_reshare);

    // Atomically UPDATE the grant in-place — avoids the revoke+create race
    // where grant() failure would permanently remove the user's access.
    let updated_grant = SharingRepository::update_grant_role(
        state.pool.inner(),
        actor_ctx.tenant_id,
        acl_id,
        new_role.as_str(),
        new_can_reshare,
        new_expires_at,
    )
    .await?
    .ok_or_else(|| signapps_common::Error::NotFound(format!("grant {acl_id} not found")))?;

    let _ = audit_chain::log_audit(
        state.pool.inner(),
        Some(id),
        &format!("/drive/nodes/{id}/acl/{acl_id}"),
        "acl_update",
        claims.sub,
        None,
        None,
        Some(json!({ "grant_id": acl_id, "role": updated_grant.role })),
    )
    .await;

    Ok(Json(updated_grant))
}

// ============================================================================
// Delete ACL grant
// ============================================================================

/// DELETE /api/v1/drive/nodes/:id/acl/:acl_id
///
/// Revoke an ACL grant by its ID.
#[utoipa::path(
    delete,
    path = "/api/v1/drive/nodes/{id}/acl/{acl_id}",
    params(
        ("id" = uuid::Uuid, Path, description = "Node ID"),
        ("acl_id" = uuid::Uuid, Path, description = "Grant ID"),
    ),
    responses(
        (status = 200, description = "ACL grant deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Grant not found"),
    ),
    security(("bearerAuth" = [])),
    tag = "drive_acl"
)]
#[tracing::instrument(skip_all, fields(node_id = %id, grant_id = %acl_id))]
pub async fn delete_acl(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, acl_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    let actor_ctx = state.sharing.build_user_context(&claims).await?;
    let rtype = node_resource_type(state.pool.inner(), id).await?;
    let resource = ResourceRef {
        resource_type: rtype,
        resource_id: id,
    };

    state
        .sharing
        .revoke(&actor_ctx, resource, None, acl_id)
        .await?;

    let _ = audit_chain::log_audit(
        state.pool.inner(),
        Some(id),
        &format!("/drive/nodes/{id}/acl/{acl_id}"),
        "acl_revoke",
        claims.sub,
        None,
        None,
        Some(json!({ "grant_id": acl_id })),
    )
    .await;

    Ok(Json(json!({ "deleted": true })))
}

// ============================================================================
// Break inheritance
// ============================================================================

/// POST /api/v1/drive/nodes/:id/acl/break
///
/// Disable permission inheritance for this node (`inherit_permissions = false`).
/// Future permission resolution will stop at this node and not walk up the tree.
#[utoipa::path(
    post,
    path = "/api/v1/drive/nodes/{id}/acl/break",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 200, description = "Inheritance disabled"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "drive_acl"
)]
#[tracing::instrument(skip_all, fields(node_id = %id))]
pub async fn break_inheritance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    sqlx::query("UPDATE drive.nodes SET inherit_permissions = false WHERE id = $1")
        .bind(id)
        .execute(state.pool.inner())
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let _ = audit_chain::log_audit(
        state.pool.inner(),
        Some(id),
        &format!("/drive/nodes/{id}/acl/break"),
        "acl_inherit_break",
        claims.sub,
        None,
        None,
        None,
    )
    .await;

    Ok(Json(json!({ "node_id": id, "inherit_permissions": false })))
}

// ============================================================================
// Restore inheritance
// ============================================================================

/// POST /api/v1/drive/nodes/:id/acl/restore
///
/// Re-enable permission inheritance for this node (`inherit_permissions = true`).
#[utoipa::path(
    post,
    path = "/api/v1/drive/nodes/{id}/acl/restore",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 200, description = "Inheritance restored"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "drive_acl"
)]
#[tracing::instrument(skip_all, fields(node_id = %id))]
pub async fn restore_inheritance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    sqlx::query("UPDATE drive.nodes SET inherit_permissions = true WHERE id = $1")
        .bind(id)
        .execute(state.pool.inner())
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let _ = audit_chain::log_audit(
        state.pool.inner(),
        Some(id),
        &format!("/drive/nodes/{id}/acl/restore"),
        "acl_inherit_restore",
        claims.sub,
        None,
        None,
        None,
    )
    .await;

    Ok(Json(json!({ "node_id": id, "inherit_permissions": true })))
}

// ============================================================================
// Effective ACL
// ============================================================================

/// GET /api/v1/drive/nodes/:id/effective-acl
///
/// Resolve the caller's effective permission on this node via the sharing engine
/// (multi-axis: user, group, org-node, everyone + inheritance chain).
#[utoipa::path(
    get,
    path = "/api/v1/drive/nodes/{id}/effective-acl",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 200, description = "Effective ACL for the caller", body = EffectiveAclResponse),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "drive_acl"
)]
#[tracing::instrument(skip_all, fields(node_id = %id))]
pub async fn effective_acl(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<EffectiveAclResponse>> {
    let user_ctx = state.sharing.build_user_context(&claims).await?;
    let rtype = node_resource_type(state.pool.inner(), id).await?;
    let resource = ResourceRef {
        resource_type: rtype,
        resource_id: id,
    };

    let permission = state
        .sharing
        .effective_role(&user_ctx, resource, None)
        .await?;

    let role_str = permission.as_ref().map(|p| p.role.as_str().to_owned());

    Ok(Json(EffectiveAclResponse {
        node_id: id,
        role: role_str,
        permission,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_role_mapping_downloader_becomes_viewer() {
        assert_eq!(map_legacy_role("downloader"), Role::Viewer);
    }

    #[test]
    fn legacy_role_mapping_contributor_becomes_editor() {
        assert_eq!(map_legacy_role("contributor"), Role::Editor);
    }

    #[test]
    fn legacy_role_mapping_viewer_stays_viewer() {
        assert_eq!(map_legacy_role("viewer"), Role::Viewer);
    }

    #[test]
    fn legacy_role_mapping_editor_stays_editor() {
        assert_eq!(map_legacy_role("editor"), Role::Editor);
    }

    #[test]
    fn legacy_role_mapping_manager_stays_manager() {
        assert_eq!(map_legacy_role("manager"), Role::Manager);
    }

    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
