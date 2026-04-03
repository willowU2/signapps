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
        crate::handlers::accounts::list_accounts,
        crate::handlers::accounts::get_account,
        crate::handlers::accounts::create_account,
        crate::handlers::accounts::update_account,
        crate::handlers::accounts::delete_account,
        crate::handlers::accounts::sync_account_now,
        // Folders
        crate::handlers::folders::list_folders,
        crate::handlers::folders::get_folder,
        // Emails
        crate::handlers::emails::list_emails,
        crate::handlers::emails::get_email,
        crate::handlers::email_send::send_email,
        crate::handlers::emails::update_email,
        crate::handlers::emails::delete_email,
        crate::handlers::emails::list_attachments,
        // Labels
        crate::handlers::labels::list_labels,
        crate::handlers::labels::create_label,
        crate::handlers::labels::update_label,
        crate::handlers::labels::delete_label,
        // Mailing Lists
        crate::handlers::mailing_lists::list_mailing_lists,
        crate::handlers::mailing_lists::mass_unsubscribe,
        // Internal Stalwart Mail Server
        crate::handlers::internal_server::get_status,
        crate::handlers::internal_server::list_domains,
        crate::handlers::internal_server::list_accounts,
        crate::handlers::internal_server::create_account,
        crate::handlers::internal_server::delete_account,
    ),
    components(
        schemas(
            crate::models::MailAccount,
            crate::models::MailFolder,
            crate::models::Email,
            crate::models::Attachment,
            crate::models::MailLabel,
            crate::handlers::accounts::CreateAccountRequest,
            crate::handlers::accounts::UpdateAccountRequest,
            crate::handlers::email_send::SendEmailRequest,
            crate::handlers::emails::UpdateEmailRequest,
            crate::handlers::labels::CreateLabelRequest,
            crate::handlers::labels::UpdateLabelRequest,
            crate::handlers::mailing_lists::MailingListEntry,
            crate::handlers::mailing_lists::UnsubscribeRequest,
            crate::handlers::mailing_lists::UnsubscribeItem,
            crate::handlers::mailing_lists::UnsubscribeResult,
            crate::handlers::internal_server::StalwartStatus,
            crate::handlers::internal_server::CreateMailboxRequest,
            crate::handlers::internal_server::CreateMailboxResponse,
            crate::handlers::internal_server::StalwartDomain,
            crate::handlers::internal_server::StalwartAccount,
        )
    ),
    tags(
        (name = "mail-accounts", description = "Mail account management"),
        (name = "mail-folders", description = "IMAP folder browsing"),
        (name = "mail-emails", description = "Email CRUD and sending"),
        (name = "mail-labels", description = "Email label management"),
        (name = "mail-mailing-lists", description = "Mailing list detection and unsubscribe"),
        (name = "mail-internal-server", description = "Internal Stalwart Mail Server management"),
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
