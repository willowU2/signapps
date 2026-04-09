//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! Spec served at `GET /api-docs/openapi.json`, Swagger UI at `/swagger-ui/`.

use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// Top-level OpenAPI document for the Collaboration service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Collaboration Service",
        version = "1.0.0",
        description = "Boards, mind maps, kanban, and collaborative workspaces.",
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0"),
    ),
    servers(
        (url = "http://localhost:3034", description = "Local development"),
    ),
    paths(
        crate::list_boards,
        crate::create_board,
        crate::get_board,
        crate::update_board,
        crate::delete_board,
    ),
    components(
        schemas(
            crate::BoardRow,
            crate::CreateBoardRequest,
            crate::UpdateBoardRequest,
        )
    ),
    tags(
        (name = "collaboration", description = "Boards and collaborative workspaces"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct CollaborationApiDoc;

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
    SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", CollaborationApiDoc::openapi())
}
