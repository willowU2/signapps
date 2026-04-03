//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `GatewayApiDoc` collects all annotated paths and schemas for the
//! SignApps API Gateway.
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

/// Top-level OpenAPI document for the Gateway service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Gateway",
        version = "1.0.0",
        description = "Reverse-proxy API gateway that routes traffic to internal services and exposes a minimal GraphQL endpoint."
    ),
    servers(
        (url = "http://localhost:3099", description = "Local development"),
    ),
    paths(
        // System
        crate::gateway_health,
        // Discovery
        crate::discover_apps,
        // Proxy (catch-all — representative entry)
        crate::proxy_handler,
        // GraphQL
        crate::graphql::graphql_handler,
        crate::graphql::graphql_schema,
    ),
    components(schemas(
        crate::graphql::GraphQLRequest,
        crate::graphql::GraphQLResponse,
        crate::graphql::GraphQLError,
    )),
    tags(
        (name = "System", description = "Gateway health and status"),
        (name = "Discovery", description = "Dynamic application discovery"),
        (name = "Proxy", description = "Transparent reverse-proxy to backend services"),
        (name = "GraphQL", description = "Minimal GraphQL gateway endpoint"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct GatewayApiDoc;

/// Returns a `SwaggerUi` router for the Gateway service.
pub fn swagger_router() -> SwaggerUi {
    SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", GatewayApiDoc::openapi())
}
