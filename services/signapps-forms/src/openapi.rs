//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `FormsApiDoc` collects all annotated paths and schemas.
//! Spec served at `GET /api-docs/openapi.json`, Swagger UI at `/swagger-ui/`.

use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// Top-level OpenAPI document for the Forms service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Forms Service",
        version = "1.0.0",
        description = "Form builder and response collector (Google Forms equivalent).",
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0"),
    ),
    servers(
        (url = "http://localhost:3015", description = "Local development"),
    ),
    paths(
        crate::list_forms,
        crate::create_form,
        crate::get_form,
        crate::update_form,
        crate::delete_form,
        crate::publish_form,
        crate::unpublish_form,
        crate::submit_response,
        crate::list_responses,
        crate::set_webhook,
        crate::get_webhook,
    ),
    components(
        schemas(
            crate::CreateFormRequest,
            crate::CreateFieldRequest,
            crate::UpdateFormRequest,
            crate::SubmitResponseRequest,
            crate::SetWebhookRequest,
            crate::WebhookConfig,
            signapps_db::models::Form,
            signapps_db::models::FormField,
            signapps_db::models::FieldType,
            signapps_db::models::FormResponse,
            signapps_db::models::Answer,
        )
    ),
    tags(
        (name = "forms", description = "Form CRUD, publish/unpublish and response collection"),
        (name = "forms-webhooks", description = "Form webhook configuration"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct FormsApiDoc;

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
    SwaggerUi::new("/swagger-ui/{_:.*}").url("/api-docs/openapi.json", FormsApiDoc::openapi())
}
