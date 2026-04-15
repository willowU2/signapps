// Enforce documentation on all public items (only during `cargo doc`, not clippy)
#![cfg_attr(doc, warn(missing_docs))]

//! # SignApps DB Identity
//!
//! Identity domain database models and repositories for the SignApps Platform.
//!
//! Contains models and repositories for:
//! - Users, Sessions, API Keys
//! - User Preferences (sync, conflict resolution)
//! - Groups, Roles, Webhooks (RBAC)
//! - LDAP/Active Directory configuration
//! - Audit Log (platform-level)
//! - Org structure: Persons (Party Model), Org Trees, Org Nodes, Assignments, Sites,
//!   Permission Profiles, Org Groups, Org Policies, Org Boards, Org Delegations,
//!   Org Audit Log
//!
//! This is Phase 6 of the `signapps-db` bounded-context split.
//! See `docs/architecture/refactors/01-split-signapps-db.md`.

pub mod models;
pub mod repositories;

// Flat model re-exports
pub use models::audit_log::*;
pub use models::core_org::*;
pub use models::group::*;
pub use models::ldap::*;
pub use models::org_audit::*;
pub use models::org_boards::*;
pub use models::org_delegations::*;
pub use models::org_groups::*;
pub use models::org_policies::*;
pub use models::user::*;
pub use models::user_preferences::*;

// Repository re-exports
pub use repositories::{
    AssignmentRepository, AuditLogRepository, AuditRepository, BoardRepository,
    DelegationRepository, GroupRepository, LdapRepository, OrgGroupRepository, OrgNodeRepository,
    OrgTreeRepository, PermissionProfileRepository, PersonRepository, PolicyRepository,
    PolicyResolver, SiteRepository, UserPreferencesRepository, UserRepository,
};

// Re-export DatabasePool from signapps-db-shared for convenience
pub use signapps_db_shared::DatabasePool;
