//! DNS blacklist (DNSBL) checker.
//!
//! Queries configured DNSBL servers to check if a sender IP is listed.
//! Uses the standard DNSBL protocol: reverse the IP octets, append the
//! DNSBL domain, and perform an A record lookup. A positive response
//! (any A record returned) means the IP is listed.
//!
//! DNS lookups are abstracted behind the [`DnsBlResolver`] trait for
//! testability with mock resolvers.

use std::net::IpAddr;

use crate::scorer::SpamTest;

/// Trait for DNSBL DNS resolution.
///
/// Implementors perform A record lookups against DNSBL servers.
/// The default implementation uses `trust-dns-resolver`, but tests
/// can provide a mock that returns predetermined results.
///
/// # Errors
///
/// Implementations should return `Ok(true)` if listed, `Ok(false)` if not,
/// and should not propagate DNS errors (treat them as non-hits).
///
/// # Panics
///
/// Implementations must not panic.
#[async_trait::async_trait]
pub trait DnsBlResolver: Send + Sync {
    /// Check if the given query name resolves (DNSBL hit).
    ///
    /// Returns `true` if the IP is listed on this DNSBL.
    async fn is_listed(&self, query: &str) -> bool;
}

/// Mock DNSBL resolver for testing.
///
/// Returns `true` for any query that contains a domain in the `listed` set.
///
/// # Examples
///
/// ```
/// use signapps_spam::dnsbl::MockDnsBlResolver;
///
/// let resolver = MockDnsBlResolver::new(vec!["zen.spamhaus.org".to_string()]);
/// ```
#[derive(Debug, Clone)]
pub struct MockDnsBlResolver {
    /// DNSBL domains that should return a positive hit.
    pub listed: Vec<String>,
}

impl MockDnsBlResolver {
    /// Create a new mock resolver.
    ///
    /// Any query ending with a domain in `listed` will return `true`.
    pub fn new(listed: Vec<String>) -> Self {
        Self { listed }
    }
}

#[async_trait::async_trait]
impl DnsBlResolver for MockDnsBlResolver {
    async fn is_listed(&self, query: &str) -> bool {
        self.listed.iter().any(|domain| query.ends_with(domain))
    }
}

/// A no-op resolver that always reports no listing.
///
/// Used when DNSBL checking is disabled or in synchronous contexts.
pub struct NullDnsBlResolver;

#[async_trait::async_trait]
impl DnsBlResolver for NullDnsBlResolver {
    async fn is_listed(&self, _query: &str) -> bool {
        false
    }
}

/// Check a sender IP against the configured DNSBL servers.
///
/// Returns a list of [`SpamTest`] results — one per DNSBL hit.
/// Each hit adds +4 to the spam score.
///
/// # Arguments
///
/// * `sender_ip` — The IP address of the sending MTA.
/// * `dnsbl_servers` — List of DNSBL domain names to query.
/// * `resolver` — DNS resolver implementation.
///
/// # Errors
///
/// DNS resolution errors are silently treated as non-hits.
///
/// # Panics
///
/// None.
pub async fn check_dnsbl<R: DnsBlResolver>(
    sender_ip: &IpAddr,
    dnsbl_servers: &[String],
    resolver: &R,
) -> Vec<SpamTest> {
    let mut tests = Vec::new();

    // Only IPv4 is supported for DNSBL (IPv6 DNSBL is rare)
    let reversed = match sender_ip {
        IpAddr::V4(ipv4) => {
            let octets = ipv4.octets();
            format!("{}.{}.{}.{}", octets[3], octets[2], octets[1], octets[0])
        },
        IpAddr::V6(_) => return tests, // Skip IPv6 for DNSBL
    };

    for server in dnsbl_servers {
        let query = format!("{}.{}", reversed, server);
        if resolver.is_listed(&query).await {
            tests.push(SpamTest {
                name: "DNSBL_HIT".to_string(),
                score: 4.0,
                description: format!("Sender IP {} listed on {}", sender_ip, server),
            });
        }
    }

    tests
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_dnsbl_hit() {
        let resolver = MockDnsBlResolver::new(vec!["zen.spamhaus.org".to_string()]);
        let ip: IpAddr = "1.2.3.4".parse().unwrap();
        let servers = vec!["zen.spamhaus.org".to_string()];

        let results = check_dnsbl(&ip, &servers, &resolver).await;
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "DNSBL_HIT");
        assert_eq!(results[0].score, 4.0);
    }

    #[tokio::test]
    async fn test_dnsbl_no_hit() {
        let resolver = MockDnsBlResolver::new(vec![]); // Nothing listed
        let ip: IpAddr = "1.2.3.4".parse().unwrap();
        let servers = vec!["zen.spamhaus.org".to_string()];

        let results = check_dnsbl(&ip, &servers, &resolver).await;
        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn test_dnsbl_multiple_servers() {
        let resolver = MockDnsBlResolver::new(vec![
            "zen.spamhaus.org".to_string(),
            "b.barracudacentral.org".to_string(),
        ]);
        let ip: IpAddr = "10.0.0.1".parse().unwrap();
        let servers = vec![
            "zen.spamhaus.org".to_string(),
            "b.barracudacentral.org".to_string(),
        ];

        let results = check_dnsbl(&ip, &servers, &resolver).await;
        assert_eq!(results.len(), 2);
        // +4 per hit = 8 total
        let total: f32 = results.iter().map(|t| t.score).sum();
        assert_eq!(total, 8.0);
    }

    #[tokio::test]
    async fn test_dnsbl_ipv6_skipped() {
        let resolver = MockDnsBlResolver::new(vec!["zen.spamhaus.org".to_string()]);
        let ip: IpAddr = "::1".parse().unwrap();
        let servers = vec!["zen.spamhaus.org".to_string()];

        let results = check_dnsbl(&ip, &servers, &resolver).await;
        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn test_null_resolver_no_hits() {
        let resolver = NullDnsBlResolver;
        let ip: IpAddr = "1.2.3.4".parse().unwrap();
        let servers = vec!["zen.spamhaus.org".to_string()];

        let results = check_dnsbl(&ip, &servers, &resolver).await;
        assert!(results.is_empty());
    }

    #[test]
    fn test_ip_reversal() {
        let ip: IpAddr = "1.2.3.4".parse().unwrap();
        match ip {
            IpAddr::V4(ipv4) => {
                let octets = ipv4.octets();
                let reversed = format!("{}.{}.{}.{}", octets[3], octets[2], octets[1], octets[0]);
                assert_eq!(reversed, "4.3.2.1");
            },
            _ => panic!("expected IPv4"),
        }
    }
}
