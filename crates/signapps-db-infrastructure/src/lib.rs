// Enforce documentation on all public items (only during `cargo doc`, not clippy)
#![cfg_attr(doc, warn(missing_docs))]

//! # SignApps DB Infrastructure
//!
//! Infrastructure domain database models and repositories for the SignApps Platform.
//!
//! Contains models and repositories for:
//! - Active Directory domains and domain controllers
//! - AD synchronization queue, OUs, user accounts
//! - AD-integrated DNS zones and records
//! - Kerberos principal keys
//! - Infrastructure domains, certificates, DHCP scopes/leases, deploy profiles
//!
//! This is Phase 5 of the `signapps-db` bounded-context split.
//! See `docs/architecture/refactors/01-split-signapps-db.md`.

pub mod models;
pub mod repositories;

pub use models::ad_dns::*;
pub use models::ad_domain::*;
pub use models::ad_principal_keys::*;
pub use models::ad_sync::*;
pub use models::infrastructure::*;

pub use repositories::{
    AdDnsRepository, AdDomainRepository, AdOuRepository, AdPrincipalKeysRepository,
    AdSyncQueueRepository, AdUserAccountRepository, DeployProfileRepository, DhcpLeaseRepository,
    DhcpScopeRepository, InfraCertificateRepository, InfraDomainRepository,
};
