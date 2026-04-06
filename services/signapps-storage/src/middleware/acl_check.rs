//! ACL check middleware for drive node routes.
//!
//! Extracts the node UUID from the URL path (routes under `/drive/nodes/:id/...`),
//! maps the HTTP method + path to a minimum required role, and verifies that the
//! authenticated user holds at least that role via the [`SharingEngine`].
//!
//! Routes that do not contain a `/drive/nodes/<uuid>` segment (e.g. the root
//! listing, create-node, or health) are passed through unchanged.
//!
//! ## Role mapping from legacy 5-role to sharing-engine 3-role
//!
//! | Legacy `downloader` | → `viewer`  |
//! | Legacy `contributor`| → `editor`  |
//! | `viewer`, `editor`, `manager` | identity |
//!
//! The middleware maps the legacy role names to the sharing engine's
//! [`Role`] before performing the check.

use axum::{
    body::Body,
    extract::{Request, State},
    http::{Method, StatusCode},
    middleware::Next,
    response::Response,
};
use signapps_common::auth::Claims;
use signapps_sharing::types::{Action, ResourceRef, ResourceType, Role};
use uuid::Uuid;

use crate::{services::audit_chain, AppState};

// ============================================================================
// Route → required-role mapping
// ============================================================================

/// Derive the minimum required role from the HTTP method and URI path.
///
/// Returns `None` when the request does not target a specific node (the
/// middleware should then let the request through unconditionally).
fn required_role(method: &Method, path: &str) -> Option<Role> {
    // Audit routes – no per-node ACL required (handler enforces admin role)
    if path.contains("/drive/audit") {
        return None;
    }

    // Routes that act on a specific node (:id segment)
    if path.contains("/drive/nodes/") {
        // Share / ACL management
        if path.ends_with("/acl")
            || path.contains("/acl/")
            || path.ends_with("/acl/break")
            || path.ends_with("/acl/restore")
        {
            if matches!(*method, Method::POST | Method::PUT | Method::DELETE) {
                return Some(Role::Manager);
            }
            // GET /acl or GET /effective-acl → viewer can read grants
            return Some(Role::Viewer);
        }

        // Share routes (POST /nodes/:id/share)
        if path.contains("/share") && *method == Method::POST {
            return Some(Role::Editor);
        }

        // Download (GET …/download) — downloader = viewer in new model
        if path.ends_with("/download") && *method == Method::GET {
            return Some(Role::Viewer);
        }

        // Effective-ACL read
        if path.ends_with("/effective-acl") && *method == Method::GET {
            return Some(Role::Viewer);
        }

        // Node mutations (rename, move, update) → editor
        if matches!(*method, Method::PUT | Method::PATCH) {
            return Some(Role::Editor);
        }

        // Node creation within a parent folder
        if *method == Method::POST {
            return Some(Role::Editor);
        }

        // Node deletion → manager
        if *method == Method::DELETE {
            return Some(Role::Manager);
        }

        // Default for GET on a specific node → viewer
        if *method == Method::GET {
            return Some(Role::Viewer);
        }
    }

    // All other paths (root listing, create at root, file routes, etc.) → skip
    None
}

// ============================================================================
// UUID extraction
// ============================================================================

/// Extract the first valid UUID that appears after `/drive/nodes/` in `path`.
fn extract_node_id(path: &str) -> Option<Uuid> {
    let prefix = "/drive/nodes/";
    let after = path.find(prefix).map(|i| &path[i + prefix.len()..])?;
    // The UUID ends at the next `/` or end-of-string
    let segment = after.split('/').next()?;
    Uuid::parse_str(segment).ok()
}

// ============================================================================
// Map Role to Action for the sharing engine check
// ============================================================================

fn role_to_action(role: Role) -> Action {
    match role {
        Role::Viewer => Action::read(),
        Role::Editor => Action::write(),
        Role::Manager => Action::new("manage"),
        Role::Deny => Action::read(),
    }
}

// ============================================================================
// Middleware function
// ============================================================================

/// ACL check middleware.
///
/// Apply this with `axum::middleware::from_fn_with_state` on drive routes that
/// carry a `:id` path parameter, after `auth_middleware` has already injected
/// `Claims` into the request extensions.
pub async fn acl_check_middleware(
    State(state): State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, (StatusCode, String)> {
    let path = request.uri().path().to_owned();
    let method = request.method().clone();

    // 1. Determine required role — if None, no ACL check needed → pass through
    let role = match required_role(&method, &path) {
        Some(r) => r,
        None => return Ok(next.run(request).await),
    };

    // 2. Extract node_id — if absent, we cannot check ACL → pass through
    let node_id = match extract_node_id(&path) {
        Some(id) => id,
        None => return Ok(next.run(request).await),
    };

    // 3. Extract authenticated user from extensions (injected by auth_middleware)
    let claims = match request.extensions().get::<Claims>() {
        Some(c) => c.clone(),
        None => {
            return Err((
                StatusCode::UNAUTHORIZED,
                "Authentication required".to_string(),
            ));
        },
    };

    // 4. Build user context and check permission via the sharing engine
    let user_ctx = match state.sharing.build_user_context(&claims).await {
        Ok(ctx) => ctx,
        Err(_) => {
            return Err((
                StatusCode::UNAUTHORIZED,
                "Could not build user context".to_string(),
            ));
        },
    };

    // Determine resource type from DB
    let rtype: ResourceType =
        sqlx::query_scalar("SELECT node_type FROM drive.nodes WHERE id = $1")
            .bind(node_id)
            .fetch_optional(state.pool.inner())
            .await
            .ok()
            .flatten()
            .map(|t: String| {
                if t == "folder" {
                    ResourceType::Folder
                } else {
                    ResourceType::File
                }
            })
            .unwrap_or(ResourceType::File);

    let resource = ResourceRef { resource_type: rtype, resource_id: node_id };
    let action = role_to_action(role);

    let allowed = state
        .sharing
        .check(&user_ctx, resource, action, None)
        .await
        .is_ok();

    if !allowed {
        // Log the denied access attempt to the forensic audit chain
        let actor_ip = request
            .headers()
            .get("x-forwarded-for")
            .or_else(|| request.headers().get("x-real-ip"))
            .and_then(|h| h.to_str().ok())
            .map(String::from);

        let _ = audit_chain::log_audit(
            state.pool.inner(),
            Some(node_id),
            &path,
            "access_denied",
            claims.sub,
            actor_ip.as_deref(),
            None,
            Some(serde_json::json!({
                "method": method.as_str(),
                "required_role": role.as_str(),
            })),
        )
        .await;

        return Err((
            StatusCode::FORBIDDEN,
            format!(
                "Access denied: requires '{}' role on node {node_id}",
                role.as_str()
            ),
        ));
    }

    Ok(next.run(request).await)
}

// ============================================================================
// Unit tests (pure, no DB)
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_node_id_works() {
        let id = Uuid::new_v4();
        let path = format!("/api/v1/drive/nodes/{id}/acl");
        assert_eq!(extract_node_id(&path), Some(id));
    }

    #[test]
    fn extract_node_id_returns_none_for_root() {
        assert_eq!(extract_node_id("/api/v1/drive/nodes"), None);
    }

    #[test]
    fn extract_node_id_returns_none_for_non_uuid() {
        assert_eq!(extract_node_id("/api/v1/drive/nodes/root"), None);
    }

    #[test]
    fn required_role_get_viewer() {
        let role = required_role(&Method::GET, "/api/v1/drive/nodes/some-uuid");
        assert_eq!(role, Some(Role::Viewer));
    }

    #[test]
    fn required_role_put_editor() {
        let role = required_role(&Method::PUT, "/api/v1/drive/nodes/some-uuid");
        assert_eq!(role, Some(Role::Editor));
    }

    #[test]
    fn required_role_delete_manager() {
        let role = required_role(&Method::DELETE, "/api/v1/drive/nodes/some-uuid");
        assert_eq!(role, Some(Role::Manager));
    }

    #[test]
    fn required_role_get_download_is_viewer() {
        // "downloader" is now mapped to "viewer" in the 3-role model
        let role = required_role(&Method::GET, "/api/v1/drive/nodes/some-uuid/download");
        assert_eq!(role, Some(Role::Viewer));
    }

    #[test]
    fn required_role_acl_post_is_manager() {
        let role = required_role(&Method::POST, "/api/v1/drive/nodes/some-uuid/acl");
        assert_eq!(role, Some(Role::Manager));
    }

    #[test]
    fn required_role_root_listing_is_none() {
        let role = required_role(&Method::GET, "/api/v1/drive/nodes");
        assert_eq!(role, None);
    }

    #[test]
    fn required_role_audit_is_none() {
        let role = required_role(&Method::GET, "/api/v1/drive/audit");
        assert_eq!(role, None);
    }
}
