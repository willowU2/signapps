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
        crate::handlers::notifications::list_notifications,
        crate::handlers::notifications::unread_count,
        crate::handlers::notifications::create_notification,
        crate::handlers::notifications::mark_read,
        crate::handlers::notifications::mark_all_read,
        crate::handlers::notifications::delete_notification,
        crate::handlers::notifications::get_preferences,
        crate::handlers::notifications::update_preferences,
    ),
    components(
        schemas(
            crate::Notification,
            crate::CreateNotificationRequest,
            crate::handlers::notifications::NotificationItem,
            crate::handlers::notifications::NotificationPreferences,
            crate::handlers::notifications::CreateNotificationRequest,
            crate::handlers::notifications::UnreadCountResponse,
            crate::handlers::notifications::UpdatePreferencesRequest,
            crate::handlers::notifications::UpdatedCountResponse,
        )
    ),
    tags(
        (name = "notifications", description = "Legacy notification feed — list, create, and mark as read"),
        (name = "notifications-v1", description = "Rich notification feed v1 — items, preferences, deep-links"),
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
