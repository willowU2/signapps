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
        // Org nodes
        crate::handlers::org_nodes::get_node,
        crate::handlers::org_nodes::create_node,
        crate::handlers::org_nodes::update_node,
        crate::handlers::org_nodes::delete_node,
        crate::handlers::org_nodes::move_node,
        crate::handlers::org_nodes::get_children,
        crate::handlers::org_nodes::get_descendants,
        crate::handlers::org_nodes::get_ancestors,
        crate::handlers::org_nodes::get_node_assignments,
        crate::handlers::org_nodes::get_node_permissions,
        crate::handlers::org_nodes::set_node_permissions,
        crate::handlers::org_nodes::get_orgchart,
        // Persons
        crate::handlers::persons::list_persons,
        crate::handlers::persons::create_person,
        crate::handlers::persons::get_person,
        crate::handlers::persons::update_person,
        crate::handlers::persons::get_person_assignments,
        crate::handlers::persons::get_person_history,
        crate::handlers::persons::link_user,
        crate::handlers::persons::unlink_user,
        crate::handlers::persons::get_effective_permissions,
        // Sites
        crate::handlers::sites::list_sites,
        crate::handlers::sites::create_site,
        crate::handlers::sites::get_site,
        crate::handlers::sites::update_site,
        crate::handlers::sites::list_site_persons,
        crate::handlers::sites::attach_node,
        crate::handlers::sites::attach_person,
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
            // Org node schemas
            crate::handlers::org_nodes::CreateOrgNodeRequest,
            crate::handlers::org_nodes::UpdateOrgNodeRequest,
            crate::handlers::org_nodes::MoveNodeRequest,
            crate::handlers::org_nodes::SetPermissionsRequest,
            crate::handlers::org_nodes::OrgchartPerson,
            signapps_db::models::core_org::OrgNode,
            signapps_db::models::core_org::OrgTree,
            signapps_db::models::core_org::Assignment,
            signapps_db::models::core_org::PermissionProfile,
            signapps_db::models::core_org::EffectivePermissions,
            signapps_db::models::core_org::UpsertPermissionProfile,
            // Person schemas
            crate::handlers::persons::CreatePersonRequest,
            crate::handlers::persons::UpdatePersonRequest,
            crate::handlers::persons::LinkUserRequest,
            crate::handlers::persons::PersonDetailResponse,
            signapps_db::models::core_org::Person,
            signapps_db::models::core_org::PersonRole,
            signapps_db::models::core_org::AssignmentHistory,
            // Site schemas
            crate::handlers::sites::CreateSiteRequest,
            crate::handlers::sites::UpdateSiteRequest,
            crate::handlers::sites::AttachNodeRequest,
            crate::handlers::sites::AttachPersonRequest,
            signapps_db::models::core_org::Site,
            signapps_db::models::core_org::NodeSite,
            signapps_db::models::core_org::PersonSite,
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
        (name = "org", description = "Organisational structure (nodes, trees, orgchart)"),
        (name = "persons", description = "Person (party model) management"),
        (name = "sites", description = "Physical site management"),
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
