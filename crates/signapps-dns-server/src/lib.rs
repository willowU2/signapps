//! AD DNS integration layer.
//!
//! Provides zone provisioning (auto-create SRV records for AD domains),
//! dynamic update support (RFC 2136), and helpers for managing DNS records
//! in the signapps-securelink DNS server.

pub mod zone;
pub mod provision;
pub mod dynamic;
