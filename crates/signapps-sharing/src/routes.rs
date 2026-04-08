//! Route registration helpers for the sharing REST API.
//!
//! [`sharing_routes`] produces an Axum [`Router`] with the per-resource sharing
//! endpoints for a given resource-type prefix.
//!
//! [`sharing_global_routes`] produces the routes that are NOT scoped to a
//! specific resource type (templates, audit, shared-with-me). Mount this once
//! per service, regardless of how many resource types it serves.
//!
//! # Route pattern
//!
//! ```text
//! // sharing_routes(prefix, resource_type) — call once per resource type
//! GET    /api/v1/{prefix}/:resource_id/grants
//! POST   /api/v1/{prefix}/:resource_id/grants
//! DELETE /api/v1/{prefix}/:resource_id/grants/:grant_id
//! PATCH  /api/v1/{prefix}/:resource_id/grants/:grant_id
//! GET    /api/v1/{prefix}/:resource_id/permissions
//! POST   /api/v1/{prefix}/:resource_id/apply-template/:template_id
//!
//! // sharing_global_routes() — mount ONCE per service
//! GET    /api/v1/sharing/templates
//! POST   /api/v1/sharing/templates
//! DELETE /api/v1/sharing/templates/:template_id
//! GET    /api/v1/sharing/audit
//! POST   /api/v1/sharing/bulk-grant
//! GET    /api/v1/shared-with-me
//! ```
//!
//! # Example
//!
//! ```rust,ignore
//! use axum::Router;
//! use signapps_sharing::engine::SharingEngine;
//! use signapps_sharing::routes::sharing_routes;
//! use signapps_sharing::types::ResourceType;
//!
//! let router: Router = Router::new()
//!     .merge(sharing_routes("files", ResourceType::File))
//!     .with_state(engine);
//! ```

use axum::{
    routing::{delete, get, post},
    Router,
};

use crate::engine::SharingEngine;
use crate::handlers::{
    apply_template_handler, bulk_grant_handler, create_grant_handler, create_template_handler,
    delete_template_handler, list_audit_handler, list_grants_handler, list_templates_handler,
    permissions_handler, revoke_grant_handler, shared_with_me_handler, update_grant_handler,
};
use crate::types::ResourceType;

// ─── sharing_routes ──────────────────────────────────────────────────────────

/// Create all sharing routes for a resource type under the given URL prefix.
///
/// The `prefix` is relative to `/api/v1/` (e.g. pass `"files"` to produce
/// routes under `/api/v1/files/:resource_id/…`).
///
/// The `resource_type` is injected as an [`axum::Extension`] layer so that
/// the shared handlers know which type they are operating on without requiring
/// an extra path segment.
///
/// # Examples
///
/// ```rust,ignore
/// use signapps_sharing::routes::sharing_routes;
/// use signapps_sharing::types::ResourceType;
///
/// let file_routes = sharing_routes("files", ResourceType::File);
/// let calendar_routes = sharing_routes("calendars", ResourceType::Calendar);
/// ```
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub fn sharing_routes(prefix: &str, resource_type: ResourceType) -> Router<SharingEngine> {
    // Resource-level routes (:resource_id required).
    // The shared-with-me route is in `sharing_global_routes` to avoid
    // double-registration when a service mounts multiple resource types.
    Router::new()
        .route(
            &format!("/api/v1/{prefix}/:resource_id/grants"),
            get(list_grants_handler).post(create_grant_handler),
        )
        .route(
            &format!("/api/v1/{prefix}/:resource_id/grants/:grant_id"),
            delete(revoke_grant_handler).patch(update_grant_handler),
        )
        .route(
            &format!("/api/v1/{prefix}/:resource_id/permissions"),
            get(permissions_handler),
        )
        .route(
            &format!("/api/v1/{prefix}/:resource_id/apply-template/:template_id"),
            post(apply_template_handler),
        )
        // Inject the resource_type so handlers know which type they serve.
        .layer(axum::Extension(resource_type))
}

/// Create global sharing routes (templates + audit) that are not tied to a
/// specific resource type prefix.
///
/// Mount these once in the application router alongside resource-specific
/// [`sharing_routes`] calls.
///
/// Routes added:
/// ```text
/// GET    /api/v1/sharing/templates
/// POST   /api/v1/sharing/templates
/// DELETE /api/v1/sharing/templates/:template_id
/// GET    /api/v1/sharing/audit
/// POST   /api/v1/sharing/bulk-grant
/// GET    /api/v1/shared-with-me
/// ```
///
/// # Examples
///
/// ```rust,ignore
/// use signapps_sharing::routes::sharing_global_routes;
///
/// let router = Router::new()
///     .merge(sharing_global_routes())
///     .with_state(engine);
/// ```
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub fn sharing_global_routes() -> Router<SharingEngine> {
    Router::new()
        .route(
            "/api/v1/sharing/templates",
            get(list_templates_handler).post(create_template_handler),
        )
        .route(
            "/api/v1/sharing/templates/:template_id",
            delete(delete_template_handler),
        )
        .route("/api/v1/sharing/audit", get(list_audit_handler))
        .route(
            "/api/v1/sharing/bulk-grant",
            post(bulk_grant_handler),
        )
        .route("/api/v1/shared-with-me", get(shared_with_me_handler))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ResourceType;

    #[test]
    fn sharing_routes_builds_without_panic() {
        // Calling sharing_routes must not panic at route-construction time.
        let _ = sharing_routes("files", ResourceType::File);
        let _ = sharing_routes("calendars", ResourceType::Calendar);
        let _ = sharing_routes("vault", ResourceType::VaultEntry);
    }

    #[test]
    fn sharing_global_routes_builds_without_panic() {
        let _ = sharing_global_routes();
    }
}
