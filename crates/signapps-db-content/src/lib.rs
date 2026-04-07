// Enforce documentation on all public items (only during `cargo doc`, not clippy)
#![cfg_attr(doc, warn(missing_docs))]

//! # SignApps DB Content
//!
//! Content domain database models and repositories for the SignApps Platform.
//!
//! Contains models and repositories for:
//! - Backup profiles and runs (container backups, Drive/storage backups)
//! - Signature envelopes, steps, and audit trail
//!
//! This is Phase 5 of the `signapps-db` bounded-context split.
//! See `docs/architecture/refactors/01-split-signapps-db.md`.

pub mod models;
pub mod repositories;

pub use models::backup::*;
pub use models::signature::*;

pub use repositories::{BackupRepository, DriveBackupRepository, SignatureRepository};
