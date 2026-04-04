//! Kerberos Key Distribution Center (KDC) implementation.
//!
//! Handles AS-REQ (Authentication Service) and TGS-REQ (Ticket Granting Service)
//! requests. Includes crypto for AES-CTS-HMAC-SHA1, RC4-HMAC, key derivation,
//! and PAC generation for Windows compatibility.

pub mod asn1;
pub mod crypto;
pub mod pac;
pub mod handlers;
pub mod keytab;
pub mod listener;
