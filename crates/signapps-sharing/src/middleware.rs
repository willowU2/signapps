//! Axum middleware for route-level permission enforcement.
//!
//! Provides [`require_permission`], a middleware factory that checks whether
//! the authenticated user has the required [`Action`] on the resource
//! identified by a path parameter.
//!
//! Services can also call [`SharingEngine::check`] directly inside handlers
//! for finer-grained control.
//!
//! # Example
//!
//! ```rust,ignore
//! use axum::{middleware, routing::get, Router};
//! use signapps_sharing::middleware::require_permission;
//! use signapps_sharing::types::{ResourceType, Action};
//!
//! let app = Router::new()
//!     .route(
//!         "/api/v1/files/:resource_id/download",
//!         get(download_handler)
//!             .route_layer(middleware::from_fn_with_state(
//!                 engine.clone(),
//!                 require_permission(ResourceType::File, Action::read(), "resource_id"),
//!             )),
//!     );
//! ```

use axum::{
    body::Body,
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use signapps_common::{Claims, Error};
use tracing::instrument;
use uuid::Uuid;

use crate::engine::SharingEngine;
use crate::types::{Action, ResourceRef, ResourceType};

// ─── require_permission ───────────────────────────────────────────────────────

/// Returns an Axum middleware that enforces a specific permission on a resource.
///
/// The middleware:
/// 1. Extracts [`Claims`] from request extensions (requires `auth_middleware` upstream).
/// 2. Extracts the resource UUID from the path parameter named `param_name`.
/// 3. Builds a [`UserContext`] via [`SharingEngine::build_user_context`].
/// 4. Calls [`SharingEngine::check`] with the given `resource_type` and `action`.
///
/// On success the request continues to the next handler. On failure a
/// [`Error::Forbidden`] or [`Error::Unauthorized`] response is returned.
///
/// # Parameters
///
/// - `resource_type` — the type of resource to check.
/// - `action` — the action that must be permitted.
/// - `param_name` — the path parameter key holding the resource UUID (e.g. `"resource_id"`).
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub fn require_permission(
    resource_type: ResourceType,
    action: Action,
    param_name: &'static str,
) -> impl Fn(
    State<SharingEngine>,
    Request,
    Next,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Response, Error>> + Send>>
       + Clone
       + Send
       + 'static {
    move |State(engine): State<SharingEngine>, request: Request, next: Next| {
        Box::pin(permission_check(engine, request, next, resource_type, action.clone(), param_name))
    }
}

/// Inner async function that performs the permission check.
#[instrument(skip(engine, request, next), fields(resource_type = %resource_type, action = %action))]
async fn permission_check(
    engine: SharingEngine,
    request: Request<Body>,
    next: Next,
    resource_type: ResourceType,
    action: Action,
    param_name: &'static str,
) -> Result<Response, Error> {
    // Extract Claims — must be set by upstream auth_middleware.
    let claims = request
        .extensions()
        .get::<Claims>()
        .ok_or(Error::Unauthorized)?
        .clone();

    // Extract the resource UUID from path parameters.
    let path_params = request
        .extensions()
        .get::<axum::extract::rejection::PathRejection>();

    // Use axum path extraction via the extensions map that axum populates.
    // We access the raw path params map stored by axum as MatchedPath data.
    let resource_id = extract_path_uuid(&request, param_name)?;

    // Build user context.
    let user_ctx = engine.build_user_context(&claims).await?;

    // Check permission.
    let resource = ResourceRef { resource_type, resource_id };
    engine.check(&user_ctx, resource, action, None).await?;

    // Suppress unused-variable warning for path_params check above.
    let _ = path_params;

    Ok(next.run(request).await)
}

/// Extract a UUID from axum path parameters stored in request extensions.
///
/// Axum stores matched path parameters in [`axum::extract::MatchedPath`]
/// extensions. This helper reads the raw `Path<std::collections::HashMap>`
/// that axum populates when a route with path parameters is matched.
///
/// Returns [`Error::BadRequest`] if the parameter is missing or not a valid UUID.
///
/// # Errors
///
/// Returns [`Error::BadRequest`] if the param is absent or malformed.
fn extract_path_uuid(request: &Request<Body>, param_name: &str) -> Result<Uuid, Error> {
    // Axum stores path params in extensions as a `HashMap<String, String>`.
    // Access via the `axum::extract::path::RawPathParams` extension.
    let params = request
        .extensions()
        .get::<axum::extract::path::RawPathParams>();

    if let Some(params) = params {
        for (key, value) in params.iter() {
            if key == param_name {
                return value
                    .parse::<Uuid>()
                    .map_err(|_| Error::BadRequest(format!("path param '{param_name}' is not a valid UUID")));
            }
        }
    }

    Err(Error::BadRequest(format!("path parameter '{param_name}' not found")))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Action;

    #[test]
    fn require_permission_returns_callable() {
        // Compile-time check: the factory must return a callable middleware.
        let _ = require_permission(ResourceType::File, Action::read(), "resource_id");
    }
}
