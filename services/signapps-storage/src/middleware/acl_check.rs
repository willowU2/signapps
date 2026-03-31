//! ACL check middleware for drive node routes.
//!
//! Extracts the node UUID from the URL path (routes under `/drive/nodes/:id/...`),
//! maps the HTTP method + path to a required ACL role, and verifies the
//! authenticated user has at least that role via `acl_resolver::resolve_effective_role`.
//!
//! Routes that do not contain a `/drive/nodes/<uuid>` segment (e.g. the root
//! listing, create-node, or health) are passed through unchanged.

use axum::{
    body::Body,
    extract::{Request, State},
    http::{Method, StatusCode},
    middleware::Next,
    response::Response,
};
use signapps_common::auth::Claims;
use uuid::Uuid;

use crate::{services::acl_resolver, services::audit_chain, AppState};

// ============================================================================
// Route → required-role mapping
// ============================================================================

/// Derive the minimum required ACL role from the HTTP method and URI path.
///
/// Returns `None` when the request does not target a specific node (the
/// middleware should then let the request through unconditionally).
fn required_role(method: &Method, path: &str) -> Option<&'static str> {
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
                return Some("manager");
            }
            // GET /acl or GET /effective-acl → viewer can read own grants
            return Some("viewer");
        }

        // Share routes with "share" in path  (POST /nodes/:id/share)
        if path.contains("/share") && *method == Method::POST {
            return Some("contributor");
        }

        // Download (GET …/download)
        if path.ends_with("/download") && *method == Method::GET {
            return Some("downloader");
        }

        // Effective-ACL read
        if path.ends_with("/effective-acl") && *method == Method::GET {
            return Some("viewer");
        }

        // Node mutations (rename, move, update) → editor
        if matches!(*method, Method::PUT | Method::PATCH) {
            return Some("editor");
        }

        // Node creation within a parent folder (POST /nodes/:id/children is not
        // standard here, but guard it anyway)
        if *method == Method::POST {
            return Some("editor");
        }

        // Node deletion → manager
        if *method == Method::DELETE {
            return Some("manager");
        }

        // Default for GET on a specific node → viewer
        if *method == Method::GET {
            return Some("viewer");
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

    let user_id = claims.sub;
    let pool = state.pool.inner();

    // 4. Resolve effective role for this user on this node
    let allowed = acl_resolver::check_permission(pool, user_id, node_id, role)
        .await
        .unwrap_or(false);

    if !allowed {
        // Log the denied access attempt to the forensic audit chain
        let actor_ip = request
            .headers()
            .get("x-forwarded-for")
            .or_else(|| request.headers().get("x-real-ip"))
            .and_then(|h| h.to_str().ok())
            .map(String::from);

        let _ = audit_chain::log_audit(
            pool,
            Some(node_id),
            &path,
            "access_denied",
            user_id,
            actor_ip.as_deref(),
            None,
            Some(serde_json::json!({
                "method": method.as_str(),
                "required_role": role,
            })),
        )
        .await;

        return Err((
            StatusCode::FORBIDDEN,
            format!("Access denied: requires '{role}' role on node {node_id}"),
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
        assert_eq!(role, Some("viewer"));
    }

    #[test]
    fn required_role_put_editor() {
        let role = required_role(&Method::PUT, "/api/v1/drive/nodes/some-uuid");
        assert_eq!(role, Some("editor"));
    }

    #[test]
    fn required_role_delete_manager() {
        let role = required_role(&Method::DELETE, "/api/v1/drive/nodes/some-uuid");
        assert_eq!(role, Some("manager"));
    }

    #[test]
    fn required_role_get_download_is_downloader() {
        let role = required_role(&Method::GET, "/api/v1/drive/nodes/some-uuid/download");
        assert_eq!(role, Some("downloader"));
    }

    #[test]
    fn required_role_acl_post_is_manager() {
        let role = required_role(&Method::POST, "/api/v1/drive/nodes/some-uuid/acl");
        assert_eq!(role, Some("manager"));
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
