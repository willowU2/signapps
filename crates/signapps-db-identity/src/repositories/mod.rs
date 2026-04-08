//! Identity domain repositories for the SignApps Platform.

pub mod audit_log_repository;
pub mod core_org_repository;
pub mod group_repository;
pub mod ldap_repository;
pub mod user_preferences_repository;
pub mod user_repository;

pub use audit_log_repository::AuditLogRepository;
// core_org_repository exports OrgGroupRepository (cross-functional groups),
// which is distinct from the RBAC GroupRepository below.
pub use core_org_repository::{
    AssignmentRepository, AuditRepository, BoardRepository, DelegationRepository,
    OrgNodeRepository, OrgTreeRepository, PermissionProfileRepository, PersonRepository,
    PolicyRepository, PolicyResolver, SiteRepository,
};
// Re-export OrgGroupRepository under an alias to avoid a name collision with RBAC GroupRepository.
pub use core_org_repository::GroupRepository as OrgGroupRepository;
pub use group_repository::GroupRepository;
pub use ldap_repository::LdapRepository;
pub use user_preferences_repository::UserPreferencesRepository;
pub use user_repository::UserRepository;
