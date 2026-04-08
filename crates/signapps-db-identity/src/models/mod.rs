//! Identity domain models for the SignApps Platform.

pub mod audit_log;
pub mod core_org;
pub mod group;
pub mod ldap;
pub mod org_audit;
pub mod org_boards;
pub mod org_delegations;
pub mod org_groups;
pub mod org_policies;
pub mod user;
pub mod user_preferences;

// Flat re-exports so that `crate::models::Foo` works in repositories.
pub use audit_log::*;
pub use core_org::*;
pub use group::*;
pub use ldap::*;
pub use org_audit::*;
pub use org_boards::*;
pub use org_delegations::*;
pub use org_groups::*;
pub use org_policies::*;
pub use user::*;
pub use user_preferences::*;
