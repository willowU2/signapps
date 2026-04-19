//! Unified RBAC contract used by every SignApps service.
//!
//! The trait [`OrgPermissionResolver`] is implemented in `signapps-org`
//! and consumed here via `Arc<dyn OrgPermissionResolver>`.  A thin
//! moka-backed decision cache lives in [`cache`] so services avoid
//! paying the SQL cost on every call.
//!
//! Gated behind the `rbac` cargo feature to keep compile-times down on
//! crates that don't care (e.g. pure-UI or offline utilities).

pub mod cache;
pub mod middleware;
pub mod resolver;
pub mod types;

pub use cache::{CacheKey, CachedDecision, DecisionCache};
pub use middleware::{
    calendar_from_path, document_from_path, folder_from_path, form_from_path,
    mail_folder_from_path, org_node_from_path, project_from_path, rbac_layer, require,
    resource_from_path, SharedResolver,
};
pub use resolver::{OrgPermissionResolver, RbacError};
pub use types::{Action, Decision, DecisionSource, DenyReason, PersonRef, ResourceRef};
