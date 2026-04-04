//! LDAP server implementation (RFC 4511).
//!
//! Provides a complete LDAP protocol server with BER codec written from scratch,
//! all standard operations (Bind, Search, Add, Modify, Delete, ModifyDN, Compare,
//! Extended), and TCP/TLS listener support.

pub mod codec;
pub mod connection;
pub mod listener;
pub mod ops;
pub mod session;
