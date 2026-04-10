//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `IdentityApiDoc` derives `OpenApi` and collects all annotated paths and schemas.
//! The spec is served at `GET /api/v1/openapi.json` and Swagger UI at `/swagger-ui/`.
//!
//! Handlers are progressively annotated. Remaining work tracked in
//! sub-tasks of [SIG-8](/SIG/issues/SIG-8).

use utoipa::OpenApi;

/// Top-level OpenAPI document for the Identity service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Identity Service",
        version = "1.0.0",
        description = "Authentication, authorization, and user management for the SignApps Platform.",
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0"),
    ),
    servers(
        (url = "http://localhost:3001", description = "Local development"),
    ),
    paths(
        // Auth
        crate::handlers::auth::login,
        crate::handlers::auth::logout,
        crate::handlers::auth::register,
        crate::handlers::auth::refresh,
        crate::handlers::auth::me,
        crate::handlers::auth::bootstrap,
        crate::handlers::auth::password_reset,
        crate::handlers::auth::password_reset_confirm,
        // Users
        crate::handlers::users::list,
        crate::handlers::users::get,
        crate::handlers::users::create,
        crate::handlers::users::update,
        crate::handlers::users::delete,
        crate::handlers::users::get_me,
        crate::handlers::users::update_me,
        crate::handlers::users::set_tenant,
        // Groups
        crate::handlers::groups::list,
        crate::handlers::groups::get,
        crate::handlers::groups::create,
        crate::handlers::groups::update,
        crate::handlers::groups::delete,
        crate::handlers::groups::list_members,
        crate::handlers::groups::add_member,
        crate::handlers::groups::remove_member,
        // Roles
        crate::handlers::roles::list,
        crate::handlers::roles::create,
        crate::handlers::roles::update,
        crate::handlers::roles::delete,
        // MFA
        crate::handlers::mfa::setup,
        crate::handlers::mfa::verify,
        crate::handlers::mfa::disable,
        crate::handlers::mfa::status,
        // Sessions
        crate::handlers::sessions::list,
        crate::handlers::sessions::revoke,
        crate::handlers::sessions::revoke_all,
        // API Keys
        crate::handlers::api_keys::create,
        crate::handlers::api_keys::list,
        crate::handlers::api_keys::revoke,
        crate::handlers::api_keys::patch,
        // Tenants
        crate::handlers::tenants::list_tenants,
        crate::handlers::tenants::get_tenant,
        crate::handlers::tenants::get_my_tenant,
        crate::handlers::tenants::create_tenant,
        crate::handlers::tenants::update_tenant,
        crate::handlers::tenants::delete_tenant,
        // Workspaces
        crate::handlers::tenants::list_workspaces,
        crate::handlers::tenants::list_my_workspaces,
        crate::handlers::tenants::get_workspace,
        crate::handlers::tenants::create_workspace,
        crate::handlers::tenants::update_workspace,
        crate::handlers::tenants::delete_workspace,
        crate::handlers::tenants::list_workspace_members,
        crate::handlers::tenants::add_workspace_member,
        crate::handlers::tenants::update_workspace_member_role,
        crate::handlers::tenants::remove_workspace_member,
        // Org structure moved to signapps-org service (port 3026)
        // Persons moved to signapps-contacts service (port 3021)
        // Sites moved to signapps-it-assets service (port 3022)
        // Vault endpoints moved to signapps-vault service (port 3025)
        // Compliance endpoints moved to signapps-compliance service (port 3032)
        // Resources moved to signapps-it-assets service (port 3022)
        // Audit logs moved to signapps-compliance service (port 3032)
        // CRM moved to signapps-contacts service (port 3021)
        // LMS moved to signapps-workforce service (port 3024)
        // Supply chain moved to signapps-workforce service (port 3024)
        // Comms
        crate::handlers::comms::list_announcements,
        crate::handlers::comms::create_announcement,
        crate::handlers::comms::mark_read,
        crate::handlers::comms::acknowledge,
        crate::handlers::comms::list_polls,
        crate::handlers::comms::create_poll,
        crate::handlers::comms::cast_vote,
        crate::handlers::comms::poll_results,
        crate::handlers::comms::list_news,
        crate::handlers::comms::create_news,
        // Search
        crate::handlers::search::global_search,
        crate::handlers::search::suggestions,
        crate::handlers::search::list_history,
        crate::handlers::search::clear_history,
        crate::handlers::search::list_saved,
        crate::handlers::search::create_saved,
        crate::handlers::search::delete_saved,
        // Reports
        crate::handlers::reports::list_reports,
        crate::handlers::reports::create_report,
        crate::handlers::reports::update_report,
        crate::handlers::reports::delete_report,
        crate::handlers::reports::execute_report,
        crate::handlers::reports::list_executions,
        // Help Center
        crate::handlers::help::list_faq,
        crate::handlers::help::get_faq,
        crate::handlers::help::create_ticket,
        crate::handlers::help::list_tickets,
        // Accounting paths moved to signapps-billing OpenAPI
    ),
    components(
        schemas(
            // Auth schemas
            crate::handlers::auth::LoginRequest,
            crate::handlers::auth::LoginResponse,
            crate::handlers::auth::RegisterRequest,
            crate::handlers::auth::UserResponse,
            crate::handlers::auth::RefreshRequest,
            crate::handlers::auth::PasswordResetConfirmRequest,
            // User schemas
            crate::handlers::users::UserResponse,
            crate::handlers::users::UserListResponse,
            crate::handlers::users::AdminCreateUserRequest,
            crate::handlers::users::AdminUpdateUserRequest,
            crate::handlers::users::UpdateSelfRequest,
            crate::handlers::users::SetTenantRequest,
            // Group schemas
            crate::handlers::groups::GroupResponse,
            crate::handlers::groups::GroupMemberResponse,
            crate::handlers::groups::AddMemberRequest,
            signapps_db::models::CreateGroup,
            // Role schemas
            crate::handlers::roles::RoleResponse,
            signapps_db::models::CreateRole,
            // MFA schemas
            crate::handlers::mfa::MfaSetupResponse,
            crate::handlers::mfa::MfaVerifyRequest,
            crate::handlers::mfa::MfaVerifyResponse,
            crate::handlers::mfa::MfaDisableRequest,
            crate::handlers::mfa::MfaStatusResponse,
            // Session schemas
            crate::handlers::sessions::SessionItem,
            // API key schemas
            crate::handlers::api_keys::CreateApiKeyRequest,
            crate::handlers::api_keys::CreateApiKeyResponse,
            crate::handlers::api_keys::ApiKeyItem,
            crate::handlers::api_keys::PatchApiKeyRequest,
            // Tenant schemas
            crate::handlers::tenants::TenantResponse,
            crate::handlers::tenants::CreateTenantRequest,
            crate::handlers::tenants::UpdateTenantRequest,
            // Workspace schemas
            crate::handlers::tenants::WorkspaceResponse,
            crate::handlers::tenants::WorkspaceMemberResponse,
            crate::handlers::tenants::CreateWorkspaceRequest,
            crate::handlers::tenants::UpdateWorkspaceRequest,
            crate::handlers::tenants::AddMemberRequest,
            crate::handlers::tenants::UpdateMemberRoleRequest,
            // Org schemas moved to signapps-org OpenAPI (port 3026)
            // Person schemas moved to signapps-contacts OpenAPI
            // Site schemas moved to signapps-it-assets OpenAPI
            // Vault schemas moved to signapps-vault service OpenAPI
            // Compliance schemas moved to signapps-compliance service OpenAPI (port 3032)
            // Resource schemas moved to signapps-it-assets OpenAPI
            // Audit log schemas moved to signapps-compliance service OpenAPI (port 3032)
            // CRM schemas moved to signapps-contacts OpenAPI
            // LMS schemas moved to signapps-workforce OpenAPI
            // Supply chain schemas moved to signapps-workforce OpenAPI
            // Comms schemas
            crate::handlers::comms::AnnouncementResponse,
            crate::handlers::comms::CreateAnnouncementRequest,
            crate::handlers::comms::PollResponse,
            crate::handlers::comms::CreatePollRequest,
            crate::handlers::comms::CastVoteRequest,
            crate::handlers::comms::PollResultsResponse,
            crate::handlers::comms::PollOptionTally,
            crate::handlers::comms::CommsRecord,
            // Search schemas
            crate::handlers::search::SearchResult,
            crate::handlers::search::SearchResponse,
            crate::handlers::search::SearchSuggestion,
            crate::handlers::search::SearchHistoryItem,
            crate::handlers::search::SavedSearch,
            crate::handlers::search::SaveSearchRequest,
            // Reports schemas
            crate::handlers::reports::ReportResponse,
            crate::handlers::reports::SaveReportRequest,
            crate::handlers::reports::ExecutionResponse,
            // Help Center schemas
            crate::handlers::help::FaqArticle,
            crate::handlers::help::SupportTicket,
            crate::handlers::help::CreateTicketRequest,
            // Accounting schemas moved to signapps-billing OpenAPI
        )
    ),
    tags(
        (name = "auth", description = "Authentication and session management"),
        (name = "system", description = "System bootstrap and health"),
        (name = "users", description = "User management (admin)"),
        (name = "groups", description = "Group management (RBAC)"),
        (name = "roles", description = "Role management (RBAC)"),
        (name = "mfa", description = "Multi-factor authentication"),
        (name = "sessions", description = "Session management"),
        (name = "api_keys", description = "API key management"),
        (name = "tenants", description = "Tenant management (super-admin)"),
        (name = "workspaces", description = "Workspace management"),
        // org tag moved to signapps-org OpenAPI (port 3026)
        // compliance tag moved to signapps-compliance OpenAPI (port 3032)
        // audit tag moved to signapps-compliance OpenAPI (port 3032)
        (name = "search", description = "Global search — unified search, suggestions, history, saved searches"),
        (name = "comms", description = "Internal communications — announcements, polls, news feed"),
        (name = "reports", description = "Report Builder — saved definitions, execution, and history"),
        (name = "help", description = "Help Center — FAQ articles and support tickets"),
        // Accounting tag moved to signapps-billing OpenAPI
    ),
    modifiers(&SecurityAddon),
)]
pub struct IdentityApiDoc;

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
