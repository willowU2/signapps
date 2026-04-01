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
