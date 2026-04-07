// Enforce documentation on all public items (only during `cargo doc`, not clippy)
#![cfg_attr(doc, warn(missing_docs))]

//! # SignApps DB Storage
//!
//! Storage domain database models and repositories for the SignApps Platform.
//!
//! Contains models and repositories for:
//! - Drive: nodes, permissions, audit log, alert configurations
//! - Storage Tier 2: tags, file versions
//! - Storage Tier 3: share links
//! - Storage Quota: per-user quota tracking
//!
//! This is Phase 4 of the `signapps-db` bounded-context split.
//! See `docs/architecture/refactors/01-split-signapps-db.md`.

pub mod models;
pub mod repositories;

pub use models::drive::*;
pub use models::drive_acl::*;
pub use models::storage_quota::*;
pub use models::storage_tier2::*;
pub use models::storage_tier3::*;

pub use repositories::{
    AuditAlertConfigRepository, DriveAuditLogRepository, QuotaRepository,
    StorageTier2Repository, StorageTier3Repository,
};
