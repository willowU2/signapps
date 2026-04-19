//! AD / LDAP synchronization engine for `signapps-org` (S1 W3).
//!
//! Responsibilities:
//! - Load the per-tenant [`config::AdSyncConfig`] from `org_ad_config`,
//!   decrypting the `bind_password` via the shared
//!   [`signapps_keystore::Keystore`].
//! - Open an LDAP connection through [`client::AdClient`].
//! - Run one sync cycle at a time via [`sync::run_cycle`], which walks
//!   the AD user list and upserts [`signapps_db::models::org::Person`]
//!   rows while emitting `org.person.synced_from_ad` events.
//! - Resolve divergences per the tenant's
//!   [`signapps_db::models::org::ConflictStrategy`] using
//!   [`conflict::resolve`].
//!
//! The per-tenant worker loop lives in
//! [`crate::spawn_ad_sync_workers`] in the parent crate.

pub mod client;
pub mod config;
pub mod conflict;
pub mod sync;
