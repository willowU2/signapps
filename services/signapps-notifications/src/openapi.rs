//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `NotificationsApiDoc` collects all annotated paths and schemas.
//! Spec served at `GET /api-docs/openapi.json`, Swagger UI at `/swagger-ui/`.

use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// Top-level OpenAPI document for the Notifications service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Notifications Service",
        version = "1.0.0",
        description = "Per-user notification feed with read/unread state management.",
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0"),
    ),
    servers(
        (url = "http://localhost:8095", description = "Local development"),
    ),
    paths(
        crate::list_notifications,
        crate::create_notification,
        crate::mark_read,
        crate::mark_all_read,
    ),
    components(
        schemas(
            crate::Notification,
            crate::CreateNotificationRequest,
        )
    ),
    tags(
        (name = "notifications", description = "Notification feed — list, create, and mark as read"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct NotificationsApiDoc;

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
    SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", NotificationsApiDoc::openapi())
}
