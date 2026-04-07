// Enforce documentation on all public items (only during `cargo doc`, not clippy)
#![cfg_attr(doc, warn(missing_docs))]

//! # SignApps DB Vault
//!
//! Vault domain database models and repositories for the SignApps Platform.
//!
//! Contains models and repositories for:
//! - Vault user key bundles (encrypted symmetric + private keys)
//! - Vault items (logins, cards, notes, SSH keys, API tokens)
//! - Vault folders (named, encrypted)
//! - Vault shares (person or group-level grants)
//! - Vault org keys (group-level sharing)
//! - Browse sessions (use-only proxy injection)
//! - Vault audit log
//!
//! This is Phase 5 of the `signapps-db` bounded-context split.
//! See `docs/architecture/refactors/01-split-signapps-db.md`.

pub mod models;
pub mod repositories;

pub use models::vault::*;

pub use repositories::{
    VaultAuditRepository, VaultBrowseRepository, VaultFolderRepository, VaultItemRepository,
    VaultKeysRepository, VaultOrgKeyRepository, VaultShareRepository,
};
