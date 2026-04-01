//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `AgentApiDoc` collects all annotated paths and schemas for the
//! SignApps Endpoint Agent HTTP status interface.
//! Spec served at `GET /api-docs/openapi.json`, Swagger UI at `/swagger-ui/`.

use utoipa::{
    openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme},
    Modify, OpenApi,
};
use utoipa_swagger_ui::SwaggerUi;

/// Adds the Bearer JWT security scheme to the OpenAPI spec.
pub struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
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

/// Top-level OpenAPI document for the Agent status interface.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Agent",
        version = "1.0.0",
        description = "Lightweight endpoint management agent — inventory, scripts, patches, remote access, backup, service monitoring."
    ),
    servers(
        (url = "http://localhost:9999", description = "Local agent status interface"),
    ),
    paths(
        crate::status::agent_status,
        crate::status::agent_health,
    ),
    components(schemas(
        crate::status::AgentStatusResponse,
    )),
    tags(
        (name = "System", description = "Agent health and status endpoints"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct AgentApiDoc;

/// Returns a `SwaggerUi` router for the Agent status interface.
pub fn swagger_router() -> SwaggerUi {
    SwaggerUi::new("/swagger-ui/{_:.*}")
        .url("/api-docs/openapi.json", AgentApiDoc::openapi())
}
