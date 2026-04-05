//! # SignApps AD DNS Integration
//!
//! Active Directory DNS integration layer for the SignApps Domain Controller.
//!
//! ## Architecture
//!
//! DNS hosting is delegated to `signapps-securelink`. This crate provides the
//! glue: it provisions AD-specific zones and SRV records when a new domain is
//! created, and processes dynamic update requests (RFC 2136) from domain-joined
//! machines that need to register their own A records.
//!
//! ```text
//! signapps-dc (domain create)  →  provision  →  PostgreSQL DNS tables
//! domain-joined machine        →  dynamic    →  PostgreSQL DNS tables
//!                                              ↑
//!                              signapps-securelink serves from these tables
//! ```
//!
//! ## Modules
//!
//! | Module | Description |
//! |--------|-------------|
//! | [`zone`] | Zone model and helpers — creates forward zones with SRV records |
//! | [`provision`] | High-level AD domain provisioning (SRV, A, NS records) |
//! | [`dynamic`] | Dynamic DNS update processing (RFC 2136) for machine accounts |
//!
//! ## AD SRV Records Created on Provisioning
//!
//! | Record | Purpose |
//! |--------|---------|
//! | `_ldap._tcp.<domain>` | LDAP service discovery |
//! | `_kerberos._tcp.<domain>` | Kerberos KDC discovery |
//! | `_gc._tcp.<domain>` | Global Catalog discovery |
//! | `_kpasswd._tcp.<domain>` | Password change service |
//!
//! ## Example
//!
//! ```rust,ignore
//! // Provision DNS for a new AD domain
//! signapps_dns_server::provision::provision_ad_domain(
//!     &pool,
//!     domain_id,
//!     "corp.example.com",
//!     "dc01",
//!     "192.168.1.10",
//! ).await?;
//! ```

pub mod axfr;
pub mod zone;
pub mod provision;
pub mod dynamic;
