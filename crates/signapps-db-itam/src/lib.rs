// Enforce documentation on all public items (only during `cargo doc`, not clippy)
#![cfg_attr(doc, warn(missing_docs))]

//! # SignApps DB ITAM
//!
//! IT asset management domain database models and repositories for the SignApps Platform.
//!
//! Contains models and repositories for:
//! - Devices (VPN/SecureLink mesh nodes — lighthouses, relays, endpoints)
//! - Containers (managed Docker containers with quotas)
//! - RAID arrays and disks
//!
//! This is Phase 5 of the `signapps-db` bounded-context split.
//! See `docs/architecture/refactors/01-split-signapps-db.md`.

pub mod models;
pub mod repositories;

pub use models::container::*;
pub use models::device::*;
pub use models::raid::*;

pub use repositories::{ContainerRepository, DeviceRepository, RaidRepository};
