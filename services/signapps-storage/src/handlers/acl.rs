//! Drive ACL management handlers.
//!
//! Endpoints:
//! - GET    /api/v1/drive/nodes/:id/acl            → list_acl
//! - POST   /api/v1/drive/nodes/:id/acl            → create_acl
//! - PUT    /api/v1/drive/nodes/:id/acl/:acl_id    → update_acl
//! - DELETE /api/v1/drive/nodes/:id/acl/:acl_id    → delete_acl
//! - POST   /api/v1/drive/nodes/:id/acl/break      → break_inheritance
//! - POST   /api/v1/drive/nodes/:id/acl/restore    → restore_inheritance
//! - GET    /api/v1/drive/nodes/:id/effective-acl  → effective_acl

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use serde_json::json;
use signapps_common::auth::Claims;
use signapps_common::Result;
use signapps_db::models::drive_acl::{CreateAcl, DriveAcl, EffectiveAcl, UpdateAcl};
use signapps_db::repositories::drive_acl_repository::AclRepository;
use uuid::Uuid;

use crate::services::{acl_resolver, audit_chain};
use crate::AppState;

// ============================================================================
// List ACL grants
// ============================================================================

/// GET /api/v1/drive/nodes/:id/acl
///
/// Returns all non-expired ACL grants directly attached to this node.
#[tracing::instrument(skip_all, fields(node_id = %id))]
pub async fn list_acl(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<DriveAcl>>> {
    let repo = AclRepository::new(&state.pool);
    let grants = repo.list_by_node(id).await?;

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
#[tracing::instrument(skip_all, fields(node_id = %id))]
pub async fn create_acl(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateAcl>,
) -> Result<(StatusCode, Json<DriveAcl>)> {
    let repo = AclRepository::new(&state.pool);
    let acl = repo.create(id, claims.sub, payload).await?;

    let _ = audit_chain::log_audit(
        state.pool.inner(),
        Some(id),
        &format!("/drive/nodes/{id}/acl"),
        "acl_grant",
        claims.sub,
        None,
        None,
        Some(json!({ "acl_id": acl.id, "role": acl.role, "grantee_type": acl.grantee_type })),
    )
    .await;

    Ok((StatusCode::CREATED, Json(acl)))
}

// ============================================================================
// Update ACL grant
// ============================================================================

/// PUT /api/v1/drive/nodes/:id/acl/:acl_id
///
/// Update the role, inheritance flag, or expiry of an existing ACL grant.
#[tracing::instrument(skip_all, fields(node_id = %id, acl_id = %acl_id))]
pub async fn update_acl(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, acl_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateAcl>,
) -> Result<Json<DriveAcl>> {
    let repo = AclRepository::new(&state.pool);
    let acl = repo.update(acl_id, payload).await?;

    let _ = audit_chain::log_audit(
        state.pool.inner(),
        Some(id),
        &format!("/drive/nodes/{id}/acl/{acl_id}"),
        "acl_update",
        claims.sub,
        None,
        None,
        Some(json!({ "acl_id": acl_id, "role": acl.role })),
    )
    .await;

    Ok(Json(acl))
}

// ============================================================================
// Delete ACL grant
// ============================================================================

/// DELETE /api/v1/drive/nodes/:id/acl/:acl_id
///
/// Revoke an ACL grant by its ID.
#[tracing::instrument(skip_all, fields(node_id = %id, acl_id = %acl_id))]
pub async fn delete_acl(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, acl_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    let repo = AclRepository::new(&state.pool);
    let deleted = repo.delete(acl_id).await?;

    let _ = audit_chain::log_audit(
        state.pool.inner(),
        Some(id),
        &format!("/drive/nodes/{id}/acl/{acl_id}"),
        "acl_revoke",
        claims.sub,
        None,
        None,
        Some(json!({ "acl_id": acl_id, "deleted": deleted })),
    )
    .await;

    Ok(Json(json!({ "deleted": deleted })))
}

// ============================================================================
// Break inheritance
// ============================================================================

/// POST /api/v1/drive/nodes/:id/acl/break
///
/// Disable permission inheritance for this node (set `inherit_permissions = false`).
/// Future permission resolution will stop at this node and not walk further up.
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
/// Re-enable permission inheritance for this node (set `inherit_permissions = true`).
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
/// Resolve the caller's effective role on this node via the full tree-walk
/// inheritance algorithm (see `acl_resolver::resolve_effective_role`).
#[tracing::instrument(skip_all, fields(node_id = %id))]
pub async fn effective_acl(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<EffectiveAcl>> {
    let effective = acl_resolver::resolve_effective_role(state.pool.inner(), claims.sub, id).await?;
    Ok(Json(effective))
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
