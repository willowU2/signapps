//! Canonical organization data model — the single source of truth for
//! the SignApps org hierarchy, persons, assignments, policies, boards,
//! access grants, AD configuration, AD sync log and provisioning log.
//!
//! This module is the W1 deliverable of the **S1 org+RBAC refonte**
//! (`docs/superpowers/specs/2026-04-18-s1-org-rbac-refonte-design.md`).
//! Workforce / `core_org` legacy types remain available during the
//! transition; they are dropped by migration 426 in W2.
//!
//! ## Design choices
//!
//! - Each entity carries `tenant_id` for multi-tenancy.
//! - The hierarchy uses a materialized path (`org_nodes.path` LTREE)
//!   so that subtree queries stay O(log n) at scale.
//! - Enums (`NodeKind`, `Axis`, `AdSyncMode`, `ConflictStrategy`) are
//!   stored as `TEXT` round-tripped via `sqlx::Type` with the
//!   `snake_case` rename rule.
//! - All structs derive `FromRow` and gate `utoipa::ToSchema` behind
//!   the `openapi` feature, matching the rest of `signapps-db`.

pub mod access_grant;
pub mod ad_config;
pub mod ad_sync_log;
pub mod assignment;
pub mod board;
pub mod node;
pub mod person;
pub mod policy;
pub mod provisioning_log;

pub use access_grant::AccessGrant;
pub use ad_config::{AdConfig, AdSyncMode, ConflictStrategy};
pub use ad_sync_log::AdSyncLog;
pub use assignment::{Assignment, Axis};
pub use board::{Board, BoardMember};
pub use node::{NodeKind, OrgNode};
pub use person::Person;
pub use policy::{PermissionSpec, Policy, PolicyBinding};
pub use provisioning_log::ProvisioningLog;
