//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `MailApiDoc` collects all annotated paths and schemas.
//! Spec served at `GET /api/v1/openapi.json`, Swagger UI at `/swagger-ui/`.

use utoipa::OpenApi;

/// Top-level OpenAPI document for the Mail service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Mail Service",
        version = "1.0.0",
        description = "IMAP/SMTP mail management for SignApps Platform.",
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0"),
    ),
    servers(
        (url = "http://localhost:3012", description = "Local development"),
    ),
    paths(
        // Accounts
        crate::api::list_accounts,
        crate::api::get_account,
        crate::api::create_account,
        crate::api::update_account,
        crate::api::delete_account,
        crate::api::sync_account_now,
        // Folders
        crate::api::list_folders,
        crate::api::get_folder,
        // Emails
        crate::api::list_emails,
        crate::api::get_email,
        crate::api::send_email,
        crate::api::update_email,
        crate::api::delete_email,
        crate::api::list_attachments,
        // Labels
        crate::api::list_labels,
        crate::api::create_label,
        crate::api::update_label,
        crate::api::delete_label,
    ),
    components(
        schemas(
            crate::models::MailAccount,
            crate::models::MailFolder,
            crate::models::Email,
            crate::models::Attachment,
            crate::models::MailLabel,
            crate::api::CreateAccountRequest,
            crate::api::UpdateAccountRequest,
            crate::api::SendEmailRequest,
            crate::api::UpdateEmailRequest,
            crate::api::CreateLabelRequest,
            crate::api::UpdateLabelRequest,
        )
    ),
    tags(
        (name = "mail-accounts", description = "Mail account management"),
        (name = "mail-folders", description = "IMAP folder browsing"),
        (name = "mail-emails", description = "Email CRUD and sending"),
        (name = "mail-labels", description = "Email label management"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct MailApiDoc;

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
