//! # SignApps Active Directory Core
//!
//! Foundational data layer for the SignApps Domain Controller. Maps PostgreSQL
//! tables (org-structure, identity, groups) to Active Directory concepts.
//!
//! ## Architecture
//!
//! This crate provides the unified [`DirectoryEntry`] abstraction that the LDAP
//! server, Kerberos KDC, and DNS modules use to access directory data. Protocol
//! servers never query PostgreSQL directly — they go through `ad-core`.
//!
//! ```text
//! ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
//! │ LDAP server  │  │ Kerberos KDC │  │  DNS server  │
//! └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
//!        └─────────────────┼─────────────────┘
//!                          │
//!              ┌───────────▼───────────┐
//!              │   signapps-ad-core    │
//!              │  (DirectoryEntry, DN, │
//!              │   SID, UAC, filter)   │
//!              └───────────┬───────────┘
//!                          │
//!              ┌───────────▼───────────┐
//!              │      PostgreSQL        │
//!              └───────────────────────┘
//! ```
//!
//! ## Modules
//!
//! | Module | Description |
//! |--------|-------------|
//! | [`dn`] | Distinguished Name parsing and building (RFC 4514) |
//! | [`sid`] | Security Identifier generation and binary encoding |
//! | [`guid`] | ObjectGUID UUID ↔ AD mixed-endian format |
//! | [`uac`] | userAccountControl bit flags (MS-ADTS §2.2.16) |
//! | [`schema`] | objectClass and attribute registry |
//! | [`filter`] | LDAP filter parser and SQL compiler (RFC 4515) |
//! | [`entry`] | DirectoryEntry — the central AD object |
//! | [`builder`] | Build DirectoryEntry from PostgreSQL tables |
//! | [`acl`] | Access control for directory operations |
//! | [`domain`] | AD domain lifecycle (create, delete) |
//! | [`crypto_helpers`] | Key derivation (AES-256, NT hash) |
//! | [`naming`] | SAM account name generation and DN builder |
//! | [`mail_resolver`] | Resolve mail domains via closure table inheritance |
//! | [`sync_worker`] | Event processor and worker loop for org→AD sync |
//!
//! ## Example
//!
//! ```rust,no_run
//! use signapps_ad_core::{DistinguishedName, SecurityIdentifier, UserAccountControl};
//!
//! let dn = DistinguishedName::parse("CN=John,OU=Users,DC=example,DC=com").unwrap();
//! assert_eq!(dn.domain_suffix(), "example.com");
//!
//! let uac = UserAccountControl::normal_user();
//! assert!(!uac.is_disabled());
//! ```

pub mod acl;
pub mod builder;
pub mod crypto_helpers;
pub mod domain;
pub mod dn;
pub mod entry;
pub mod filter;
pub mod guid;
pub mod mail_resolver;
pub mod naming;
pub mod provisioner;
pub mod schema;
pub mod sid;
pub mod sync_worker;
pub mod uac;

pub use acl::{AclDecision, AclOperation};
pub use dn::DistinguishedName;
pub use entry::{DirectoryEntry, LifecycleState};
pub use filter::LdapFilter;
pub use guid::ObjectGuid;
pub use schema::syntax::AttributeValue;
pub use sid::SecurityIdentifier;
pub use uac::UserAccountControl;
