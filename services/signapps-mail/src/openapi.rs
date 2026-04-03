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
        // Mailserver admin: Domains
        crate::handlers::domains::list_domains,
        crate::handlers::domains::create_domain,
        crate::handlers::domains::get_domain,
        crate::handlers::domains::update_domain,
        crate::handlers::domains::delete_domain,
        crate::handlers::domains::verify_dns,
        crate::handlers::domains::get_dns_records,
        // Mailserver admin: Accounts
        crate::handlers::ms_accounts::list_ms_accounts,
        crate::handlers::ms_accounts::create_ms_account,
        crate::handlers::ms_accounts::delete_ms_account,
        crate::handlers::ms_accounts::change_password,
        crate::handlers::ms_accounts::get_quota,
        // Mailserver admin: Queue
        crate::handlers::queue_admin::list_queue,
        crate::handlers::queue_admin::retry_queue_entry,
        crate::handlers::queue_admin::delete_queue_entry,
        crate::handlers::queue_admin::queue_stats,
        // Mailserver admin: Sieve
        crate::handlers::sieve_admin::list_sieve_scripts,
        crate::handlers::sieve_admin::create_sieve_script,
        crate::handlers::sieve_admin::update_sieve_script,
        crate::handlers::sieve_admin::delete_sieve_script,
        crate::handlers::sieve_admin::activate_sieve_script,
        // Service subdomains
        crate::handlers::subdomains::list_subdomains,
        crate::handlers::subdomains::create_subdomain,
        crate::handlers::subdomains::delete_subdomain,
        // Autoconfig / Autodiscover
        crate::handlers::autoconfig::thunderbird_autoconfig,
        crate::handlers::autoconfig::outlook_autodiscover,
        // JMAP (RFC 8620/8621)
        crate::jmap::session::well_known,
        crate::jmap::api::handle,
        crate::jmap::api::upload,
        crate::jmap::api::download,
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
            // Mailserver admin
            crate::handlers::domains::MailDomain,
            crate::handlers::domains::CreateDomainRequest,
            crate::handlers::domains::UpdateDomainRequest,
            crate::handlers::domains::DnsRecord,
            crate::handlers::domains::DnsVerificationResult,
            crate::handlers::domains::DnsCheck,
            crate::handlers::ms_accounts::MsAccount,
            crate::handlers::ms_accounts::CreateMsAccountRequest,
            crate::handlers::ms_accounts::ChangePasswordRequest,
            crate::handlers::ms_accounts::QuotaInfo,
            crate::handlers::queue_admin::QueueEntry,
            crate::handlers::queue_admin::QueueStats,
            crate::handlers::sieve_admin::SieveScript,
            crate::handlers::sieve_admin::CreateSieveScriptRequest,
            crate::handlers::sieve_admin::UpdateSieveScriptRequest,
            // Service subdomains
            crate::handlers::subdomains::ServiceSubdomain,
            crate::handlers::subdomains::CreateSubdomainRequest,
            // DNS provisioning
            crate::dns::securelink::DnsProvisionResult,
        )
    ),
    tags(
        (name = "mail-accounts", description = "Mail account management"),
        (name = "mail-folders", description = "IMAP folder browsing"),
        (name = "mail-emails", description = "Email CRUD and sending"),
        (name = "mail-labels", description = "Email label management"),
        (name = "mail-mailing-lists", description = "Mailing list detection and unsubscribe"),
        (name = "mail-internal-server", description = "Internal Stalwart Mail Server management"),
        (name = "mailserver-domains", description = "Mailserver domain management"),
        (name = "mailserver-accounts", description = "Mailserver account management"),
        (name = "mailserver-queue", description = "Outbound queue management"),
        (name = "mailserver-sieve", description = "Sieve script management"),
        (name = "mailserver-subdomains", description = "Service subdomain management"),
        (name = "autoconfig", description = "Email client auto-configuration"),
        (name = "jmap", description = "JMAP (RFC 8620/8621) protocol endpoints"),
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
