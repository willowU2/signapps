//! # SignApps LDAP Server
//!
//! Complete LDAP protocol server (RFC 4511) with a BER codec written from scratch.
//!
//! ## Architecture
//!
//! The server is layered: raw TCP/TLS bytes flow through the BER codec into typed
//! LDAP messages, which are dispatched to operation handlers that query the
//! directory via [`signapps_ad_core`]. Each client connection maintains an
//! [`session::LdapSession`] that tracks bind state and authentication method.
//!
//! ```text
//! TCP/TLS  →  codec (BER)  →  connection dispatcher  →  ops handlers
//!                                                              │
//!                                                      signapps-ad-core
//! ```
//!
//! ## Modules
//!
//! | Module | Description |
//! |--------|-------------|
//! | [`codec`] | BER encoder/decoder and LDAP message types (RFC 4511) |
//! | [`connection`] | Per-connection dispatcher, filter utilities, message framing |
//! | [`listener`] | TCP/TLS listener — accepts and spawns connection tasks |
//! | [`ops`] | Operation handlers: Bind, Search, Add, Modify, Delete, ModifyDN, Compare, Extended |
//! | [`session`] | Session state (bound DN, auth method, TLS flag) |
//!
//! ## Supported Operations
//!
//! | Operation | RFC 4511 § | Notes |
//! |-----------|-----------|-------|
//! | Bind | §4.2 | Simple (DN + password via Argon2); SASL/GSSAPI stub |
//! | Search | §4.5 | All scopes; filter → SQL via ad-core |
//! | Add | §4.7 | Admin-only |
//! | Modify | §4.6 | Admin-only |
//! | Delete | §4.8 | Admin-only |
//! | ModifyDN | §4.9 | Admin-only |
//! | Compare | §4.10 | Attribute equality check |
//! | Extended | §4.12 | StartTLS (OID 1.3.6.1.4.1.1466.20037) |
//!
//! ## Example
//!
//! ```rust,no_run
//! use signapps_ldap_server::listener::{LdapListener, LdapListenerConfig};
//!
//! let config = LdapListenerConfig {
//!     ldap_addr: "0.0.0.0:389".parse().unwrap(),
//!     ldaps_addr: Some("0.0.0.0:636".parse().unwrap()),
//!     max_connections: 1024,
//! };
//! let listener = LdapListener::new(config);
//! // listener.run(pool, shutdown_rx).await?;
//! ```

pub mod codec;
pub mod connection;
pub mod listener;
pub mod ops;
pub mod session;
