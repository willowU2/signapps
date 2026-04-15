//! # SignApps Kerberos KDC
//!
//! Kerberos Key Distribution Center implementation (RFC 4120 / MS-KILE).
//!
//! ## Architecture
//!
//! The KDC handles both UDP and TCP transports on port 88, and kpasswd
//! requests on port 464. ASN.1 DER encoding/decoding is implemented without
//! external ASN.1 libraries. Cryptographic operations support the encryption
//! types required by modern Windows clients.
//!
//! ```text
//! UDP/TCP :88   →  listener  →  handlers (AS-REQ / TGS-REQ / S4U)
//! UDP/TCP :464  →  listener  →  kpasswd handler
//!                                     │
//!                             signapps-ad-core  (user lookup, SID, PAC)
//! ```
//!
//! ## Modules
//!
//! | Module | Description |
//! |--------|-------------|
//! | [`asn1`] | ASN.1 DER codec and Kerberos message types (RFC 4120) |
//! | [`crypto`] | AES-CTS-HMAC-SHA1, RC4-HMAC, key derivation, checksums |
//! | [`pac`] | Privilege Attribute Certificate (MS-PAC) for Windows authorization |
//! | [`handlers`] | AS-REQ, TGS-REQ, S4U2Self/Proxy, kpasswd request handlers |
//! | [`keytab`] | Keytab file management (MIT format) |
//! | [`listener`] | UDP/TCP listener for port 88 (KDC) and port 464 (kpasswd) |
//!
//! ## Supported Encryption Types
//!
//! | etype | OID | Notes |
//! |-------|-----|-------|
//! | 17 | aes128-cts-hmac-sha1-96 | Preferred |
//! | 18 | aes256-cts-hmac-sha1-96 | Preferred |
//! | 23 | rc4-hmac | Windows legacy compatibility |
//!
//! ## Example
//!
//! ```rust,no_run
//! use signapps_kerberos_kdc::listener::{KdcListener, KdcListenerConfig};
//!
//! let config = KdcListenerConfig {
//!     kdc_addr: "0.0.0.0:88".parse().unwrap(),
//!     kpasswd_addr: "0.0.0.0:464".parse().unwrap(),
//!     max_udp_size: 65535,
//! };
//! let listener = KdcListener::new(config);
//! // listener.run(pool, shutdown_rx).await?;
//! ```

pub mod asn1;
pub mod crypto;
pub mod handlers;
pub mod keytab;
pub mod listener;
pub mod pac;
