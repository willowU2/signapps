//! Kerberos ASN.1 BER encoding/decoding.
//!
//! Kerberos messages use the same BER encoding as LDAP. The actual codec
//! will share primitives with `signapps-ldap-server::codec::ber` once
//! the BER module is extracted into a shared crate (or copied here).
//! For now, this module provides type aliases.

// Kerberos BER encoding will be implemented in a later phase
// when the BER codec is refactored into a shared location.
