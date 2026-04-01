//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `CollabApiDoc` derives `OpenApi` and collects all annotated paths and schemas.
//! The spec is served at `GET /api-docs/openapi.json` and Swagger UI at `/swagger-ui/`.

use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// Top-level OpenAPI document for the Collab service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Collab Service",
        version = "1.0.0",
        description = "Real-time collaborative document editing via Y.js/CRDT over WebSocket.",
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0"),
    ),
    servers(
        (url = "http://localhost:3013", description = "Local development"),
    ),
    paths(
        // Health
        crate::handlers::health::health_handler,
        // WebSocket
        crate::handlers::websocket::websocket_handler,
    ),
    components(
        schemas(
            crate::handlers::health::HealthResponse,
        )
    ),
    tags(
        (name = "Health", description = "Service health check"),
        (name = "Collab", description = "Real-time collaborative editing over WebSocket (Y.js CRDT)"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct CollabApiDoc;

/// Adds the Bearer JWT security scheme to the OpenAPI spec.
struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
            components.add_security_scheme(
                "bearer",
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

/// Returns a `SwaggerUi` router serving the OpenAPI spec and Swagger UI.
pub fn swagger_router() -> SwaggerUi {
    SwaggerUi::new("/swagger-ui/{_:.*}").url("/api-docs/openapi.json", CollabApiDoc::openapi())
}
