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
        // Persons moved to signapps-contacts service (port 3021)
        // Sites
        crate::handlers::sites::list_sites,
        crate::handlers::sites::create_site,
        crate::handlers::sites::get_site,
        crate::handlers::sites::update_site,
        crate::handlers::sites::list_site_persons,
        crate::handlers::sites::attach_node,
        crate::handlers::sites::attach_person,
        // Vault endpoints moved to signapps-vault service (port 3025)
        // Compliance
        crate::handlers::compliance::save_dpia,
        crate::handlers::compliance::list_dpias,
        crate::handlers::compliance::create_dsar,
        crate::handlers::compliance::list_dsars,
        crate::handlers::compliance::update_dsar,
        crate::handlers::compliance::save_retention_policies,
        crate::handlers::compliance::get_retention_policies,
        crate::handlers::compliance::save_consent,
        crate::handlers::compliance::get_consent,
        crate::handlers::compliance::save_cookie_banner,
        crate::handlers::compliance::get_cookie_banner,
        // Resources
        crate::handlers::resources::list_resource_types,
        crate::handlers::resources::create_resource_type,
        crate::handlers::resources::delete_resource_type,
        crate::handlers::resources::list_resources,
        crate::handlers::resources::get_resource,
        crate::handlers::resources::create_resource,
        crate::handlers::resources::update_resource,
        crate::handlers::resources::delete_resource,
        crate::handlers::resources::list_reservations,
        crate::handlers::resources::list_pending_reservations,
        crate::handlers::resources::list_my_reservations,
        crate::handlers::resources::get_reservation,
        crate::handlers::resources::create_reservation,
        crate::handlers::resources::update_reservation_status,
        // Audit logs
        crate::handlers::audit_logs::list_audit_logs,
        crate::handlers::audit_logs::get_audit_log,
        crate::handlers::audit_logs::export_audit_logs,
        crate::handlers::audit_logs::query_audit,
        // CRM moved to signapps-contacts service (port 3021)
        // LMS
        crate::handlers::lms::list_courses,
        crate::handlers::lms::create_course,
        crate::handlers::lms::get_course,
        crate::handlers::lms::patch_course,
        crate::handlers::lms::list_progress,
        crate::handlers::lms::track_progress,
        crate::handlers::lms::list_discussions,
        crate::handlers::lms::create_discussion,
        // Supply chain
        crate::handlers::supply_chain::list_purchase_orders,
        crate::handlers::supply_chain::create_purchase_order,
        crate::handlers::supply_chain::get_purchase_order,
        crate::handlers::supply_chain::patch_purchase_order,
        crate::handlers::supply_chain::delete_purchase_order,
        crate::handlers::supply_chain::list_warehouses,
        crate::handlers::supply_chain::create_warehouse,
        crate::handlers::supply_chain::list_inventory,
        // Comms
        crate::handlers::comms::list_announcements,
        crate::handlers::comms::create_announcement,
        crate::handlers::comms::list_polls,
        crate::handlers::comms::create_poll,
        crate::handlers::comms::patch_poll,
        crate::handlers::comms::list_news,
        crate::handlers::comms::create_news,
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
            // Person schemas moved to signapps-contacts OpenAPI
            // Site schemas
            crate::handlers::sites::CreateSiteRequest,
            crate::handlers::sites::UpdateSiteRequest,
            crate::handlers::sites::AttachNodeRequest,
            crate::handlers::sites::AttachPersonRequest,
            signapps_db::models::core_org::Site,
            signapps_db::models::core_org::NodeSite,
            signapps_db::models::core_org::PersonSite,
            // Vault schemas moved to signapps-vault service OpenAPI
            // Compliance schemas
            crate::handlers::compliance::SaveDpiaRequest,
            crate::handlers::compliance::DpiaRecord,
            crate::handlers::compliance::CreateDsarRequest,
            crate::handlers::compliance::DsarRecord,
            crate::handlers::compliance::UpdateDsarRequest,
            crate::handlers::compliance::RetentionPoliciesRequest,
            crate::handlers::compliance::RetentionPoliciesResponse,
            crate::handlers::compliance::SaveConsentRequest,
            // Resource schemas
            crate::handlers::resources::ResourceTypeResponse,
            crate::handlers::resources::CreateResourceTypeRequest,
            crate::handlers::resources::ResourceResponse,
            crate::handlers::resources::CreateResourceRequest,
            crate::handlers::resources::UpdateResourceRequest,
            crate::handlers::resources::ReservationResponse,
            crate::handlers::resources::CreateReservationRequest,
            crate::handlers::resources::UpdateReservationStatusRequest,
            // Audit log schemas
            crate::handlers::audit_logs::AuditLog,
            crate::handlers::audit_logs::AuditLogListResponse,
            crate::handlers::audit_logs::AuditQueryRequest,
            // CRM schemas moved to signapps-contacts OpenAPI
            // LMS schemas
            crate::handlers::lms::LmsRecord,
            // Supply chain schemas
            crate::handlers::supply_chain::ScRecord,
            // Comms schemas
            crate::handlers::comms::CommsRecord,
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
        (name = "org", description = "Organisational structure (nodes, trees, orgchart)"),
        (name = "sites", description = "Physical site management"),
        (name = "compliance", description = "GDPR compliance — DPIA, DSAR, retention, consent"),
        (name = "resources", description = "Resource booking — rooms, equipment, reservations"),
        (name = "audit", description = "Platform audit logs"),
        (name = "lms", description = "Learning Management System — courses, progress, discussions"),
        (name = "supply_chain", description = "Supply chain — purchase orders, warehouses, inventory"),
        (name = "comms", description = "Internal communications — announcements, polls, news feed"),
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
