//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `IdentityApiDoc` derives `OpenApi` and collects all annotated paths and schemas.
//! The spec is served at `GET /api/v1/openapi.json` and Swagger UI at `/swagger-ui/`.
//!
//! Handlers are progressively annotated. Remaining work tracked in
//! sub-tasks of [SIG-8](/SIG/issues/SIG-8).

use utoipa::OpenApi;

/// Top-level OpenAPI document for the Identity service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Identity Service",
        version = "1.0.0",
        description = "Authentication, authorization, and user management for the SignApps Platform.",
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0"),
    ),
    servers(
        (url = "http://localhost:3001", description = "Local development"),
    ),
    paths(
        crate::handlers::auth::login,
        crate::handlers::auth::logout,
        crate::handlers::auth::register,
        crate::handlers::auth::refresh,
        crate::handlers::auth::me,
        crate::handlers::auth::bootstrap,
        crate::handlers::auth::password_reset,
        crate::handlers::auth::password_reset_confirm,
    ),
    components(
        schemas(
            crate::handlers::auth::LoginRequest,
            crate::handlers::auth::LoginResponse,
            crate::handlers::auth::RegisterRequest,
            crate::handlers::auth::UserResponse,
            crate::handlers::auth::RefreshRequest,
            crate::handlers::auth::PasswordResetConfirmRequest,
        )
    ),
    tags(
        (name = "auth", description = "Authentication and session management"),
        (name = "system", description = "System bootstrap and health"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct IdentityApiDoc;

/// Adds the Bearer JWT security scheme to the OpenAPI spec.
struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
            components.add_security_scheme(
                "bearerAuth",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            );
        }
    }
}
