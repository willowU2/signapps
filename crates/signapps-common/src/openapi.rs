//! # OpenAPI Infrastructure
//!
//! Provides a reusable Axum router that serves a Swagger UI at `/api/docs`.
//!
//! Each service can mount additional path items and schemas by building its own
//! `#[derive(OpenApi)]` spec and merging it with the base spec before calling
//! [`create_openapi_router`].
//!
//! ## Usage (per-service)
//!
//! ```rust,ignore
//! use signapps_common::openapi::create_openapi_router;
//!
//! let app = Router::new()
//!     .merge(create_openapi_router())
//!     // ... service-specific routes
//! ```

use axum::Router;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// Base OpenAPI specification for SignApps Platform.
///
/// Individual services should define their own `#[derive(OpenApi)]` specs and
/// merge them into their router. This base spec provides the shared metadata
/// (title, version, license) so every service exposes consistent API docs.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Platform API",
        version = "0.1.0",
        description = "SignApps Platform — open-source, self-hosted alternative to Google Workspace.",
        license(name = "MIT", url = "https://opensource.org/licenses/MIT"),
        contact(
            name = "SignApps Team",
            url = "https://github.com/signapps/signapps-platform"
        ),
    ),
    tags(
        (name = "health", description = "Health and readiness probes"),
        (name = "auth",   description = "Authentication and authorisation"),
    ),
)]
/// Represents a api doc;.
pub struct ApiDoc;

/// Returns an Axum [`Router`] that serves the Swagger UI at `/api/docs`.
///
/// Mount this router inside your service's main `Router`:
///
/// ```rust,ignore
/// let app = Router::new()
///     .merge(create_openapi_router())
///     .route("/api/v1/...", get(handler));
/// ```
pub fn create_openapi_router() -> Router {
    SwaggerUi::new("/api/docs")
        .url("/api/docs/openapi.json", ApiDoc::openapi())
        .into()
}
