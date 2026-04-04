//! Active Directory core data layer.
//!
//! Provides the foundational types and abstractions for mapping PostgreSQL
//! tables (org-structure, identity, groups) to Active Directory concepts.
//! All protocol servers (LDAP, Kerberos, DNS) depend on this crate —
//! they never access the database directly.

pub mod acl;
pub mod dn;
pub mod entry;
pub mod filter;
pub mod guid;
pub mod schema;
pub mod sid;
pub mod uac;
