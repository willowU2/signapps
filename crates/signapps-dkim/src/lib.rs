//! Pure DKIM sign/verify, SPF checker, and DMARC evaluator for SignApps Platform.
//!
//! This crate implements email authentication standards without performing any I/O.
//! DNS lookups are abstracted behind the [`DnsResolver`] trait, allowing full
//! testability with mock resolvers.
//!
//! # Supported Standards
//!
//! - **DKIM** (RFC 6376): signing with RSA-SHA256 and Ed25519-SHA256, verification
//! - **SPF** (RFC 7208): record parsing and IP-based policy evaluation
//! - **DMARC** (RFC 7489): policy parsing, alignment checks, disposition
//!
//! # Examples
//!
//! ```no_run
//! use signapps_dkim::{DkimSigner, DkimAlgorithm};
//!
//! let pem = std::fs::read_to_string("private.pem").unwrap();
//! let signer = DkimSigner::new_rsa(&pem, "sel1", "example.com").unwrap();
//! let signed = signer.sign(b"From: a@example.com\r\n\r\nHello").unwrap();
//! ```
#![warn(missing_docs)]

pub mod canonicalize;
pub mod dmarc;
pub mod keygen;
pub mod sign;
pub mod spf;
pub mod verify;

use std::net::IpAddr;

// ── Re-exports ──────────────────────────────────────────────────────────────

pub use canonicalize::{canonicalize_body_relaxed, canonicalize_headers_relaxed};
pub use dmarc::{DmarcChecker, DmarcDisposition, DmarcResult};
pub use keygen::{generate_ed25519, generate_rsa_2048};
pub use sign::{DkimAlgorithm, DkimSigner};
pub use spf::{SpfChecker, SpfResult};
pub use verify::{DkimResult, DkimVerifier};

// ── Errors ──────────────────────────────────────────────────────────────────

/// Errors originating from DNS resolution.
#[derive(Debug, thiserror::Error)]
pub enum DnsError {
    /// The queried name does not exist (NXDOMAIN).
    #[error("DNS name not found: {0}")]
    NotFound(String),

    /// A transient network or server error occurred.
    #[error("DNS temporary error: {0}")]
    TempError(String),
}

/// Errors originating from DKIM operations (signing or verification).
#[derive(Debug, thiserror::Error)]
pub enum DkimError {
    /// The supplied PEM or raw key material is invalid.
    #[error("invalid key: {0}")]
    InvalidKey(String),

    /// The message could not be parsed (missing headers, malformed).
    #[error("invalid message: {0}")]
    InvalidMessage(String),

    /// A cryptographic operation (sign / verify) failed.
    #[error("crypto error: {0}")]
    CryptoError(String),

    /// DNS lookup failed during verification.
    #[error("DNS error: {0}")]
    DnsError(#[from] DnsError),
}

// ── DNS Resolver trait ──────────────────────────────────────────────────────

/// Asynchronous DNS resolver trait.
///
/// Implementations must be `Send + Sync` so they can be shared across async tasks.
/// The trait is intentionally minimal — only the record types needed for DKIM, SPF,
/// and DMARC are included.
///
/// # Errors
///
/// All methods return [`DnsError`] on lookup failure.
///
/// # Panics
///
/// Implementations must not panic.
#[async_trait::async_trait]
pub trait DnsResolver: Send + Sync {
    /// Look up TXT records for `domain`.
    async fn txt_lookup(&self, domain: &str) -> Result<Vec<String>, DnsError>;

    /// Look up MX records for `domain`, returning hostnames.
    async fn mx_lookup(&self, domain: &str) -> Result<Vec<String>, DnsError>;

    /// Look up A/AAAA records for `domain`, returning IP addresses.
    async fn a_lookup(&self, domain: &str) -> Result<Vec<IpAddr>, DnsError>;
}

// ── Mock resolver (available in tests and for downstream test code) ─────────

/// A mock DNS resolver that returns predefined records.
///
/// Useful for unit-testing DKIM verification, SPF checks, and DMARC evaluation
/// without performing real network queries.
///
/// # Examples
///
/// ```
/// use signapps_dkim::MockDnsResolver;
///
/// let mut resolver = MockDnsResolver::new();
/// resolver.add_txt("example.com", "v=spf1 ip4:1.2.3.4 -all");
/// ```
#[derive(Debug, Default, Clone)]
pub struct MockDnsResolver {
    txt_records: Vec<(String, Vec<String>)>,
    mx_records: Vec<(String, Vec<String>)>,
    a_records: Vec<(String, Vec<IpAddr>)>,
}

impl MockDnsResolver {
    /// Create a new empty mock resolver.
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a TXT record for the given domain.
    pub fn add_txt(&mut self, domain: &str, value: &str) {
        let domain_lower = domain.to_lowercase();
        if let Some(entry) = self
            .txt_records
            .iter_mut()
            .find(|(d, _)| *d == domain_lower)
        {
            entry.1.push(value.to_string());
        } else {
            self.txt_records
                .push((domain_lower, vec![value.to_string()]));
        }
    }

    /// Add an MX record for the given domain.
    pub fn add_mx(&mut self, domain: &str, host: &str) {
        let domain_lower = domain.to_lowercase();
        if let Some(entry) = self.mx_records.iter_mut().find(|(d, _)| *d == domain_lower) {
            entry.1.push(host.to_string());
        } else {
            self.mx_records.push((domain_lower, vec![host.to_string()]));
        }
    }

    /// Add an A/AAAA record for the given domain.
    pub fn add_a(&mut self, domain: &str, ip: IpAddr) {
        let domain_lower = domain.to_lowercase();
        if let Some(entry) = self.a_records.iter_mut().find(|(d, _)| *d == domain_lower) {
            entry.1.push(ip);
        } else {
            self.a_records.push((domain_lower, vec![ip]));
        }
    }
}

#[async_trait::async_trait]
impl DnsResolver for MockDnsResolver {
    async fn txt_lookup(&self, domain: &str) -> Result<Vec<String>, DnsError> {
        let domain_lower = domain.to_lowercase();
        self.txt_records
            .iter()
            .find(|(d, _)| *d == domain_lower)
            .map(|(_, records)| records.clone())
            .ok_or_else(|| DnsError::NotFound(domain.to_string()))
    }

    async fn mx_lookup(&self, domain: &str) -> Result<Vec<String>, DnsError> {
        let domain_lower = domain.to_lowercase();
        self.mx_records
            .iter()
            .find(|(d, _)| *d == domain_lower)
            .map(|(_, records)| records.clone())
            .ok_or_else(|| DnsError::NotFound(domain.to_string()))
    }

    async fn a_lookup(&self, domain: &str) -> Result<Vec<IpAddr>, DnsError> {
        let domain_lower = domain.to_lowercase();
        self.a_records
            .iter()
            .find(|(d, _)| *d == domain_lower)
            .map(|(_, records)| records.clone())
            .ok_or_else(|| DnsError::NotFound(domain.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn mock_resolver_txt_lookup() {
        let mut resolver = MockDnsResolver::new();
        resolver.add_txt("example.com", "v=spf1 -all");
        let result = resolver.txt_lookup("example.com").await.unwrap();
        assert_eq!(result, vec!["v=spf1 -all"]);
    }

    #[tokio::test]
    async fn mock_resolver_not_found() {
        let resolver = MockDnsResolver::new();
        let result = resolver.txt_lookup("missing.com").await;
        assert!(result.is_err());
    }
}
