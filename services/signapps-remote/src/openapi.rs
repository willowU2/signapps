//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `RemoteApiDoc` collects all annotated paths and schemas.
//! Spec served at `GET /api-docs/openapi.json`, Swagger UI at `/swagger-ui/`.

use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// Top-level OpenAPI document for the Remote service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Remote Service",
        version = "1.0.0",
        description = "Remote desktop / SSH / VNC connection management via Apache Guacamole.",
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0"),
    ),
    servers(
        (url = "http://localhost:3017", description = "Local development"),
    ),
    paths(
        crate::handlers::list_connections,
        crate::handlers::create_connection,
        crate::handlers::get_connection,
        crate::handlers::update_connection,
        crate::handlers::delete_connection,
        crate::handlers::connection_gateway_ws,
    ),
    components(
        schemas(
            crate::models::RemoteConnection,
            crate::models::CreateConnectionRequest,
            crate::models::UpdateConnectionRequest,
        )
    ),
    tags(
        (name = "remote-connections", description = "Remote connection management and WebSocket gateway"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct RemoteApiDoc;

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

/// Returns the SwaggerUi router to be merged into the main Axum router.
pub fn swagger_router() -> SwaggerUi {
    SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", RemoteApiDoc::openapi())
}
