//! SPF record parser and evaluator (RFC 7208).
//!
//! Parses SPF TXT records and evaluates whether a sender IP is authorized
//! to send mail for a given domain.

use std::net::IpAddr;

use crate::{DnsError, DnsResolver};

/// Maximum number of DNS lookups allowed during SPF evaluation (RFC 7208 §4.6.4).
const MAX_DNS_LOOKUPS: usize = 10;

/// Result of an SPF check.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SpfResult {
    /// The sender IP is authorized.
    Pass,
    /// The sender IP is explicitly not authorized.
    Fail,
    /// The sender IP is probably not authorized (soft fail).
    SoftFail,
    /// The domain makes no assertion about the IP.
    Neutral,
    /// No SPF record found.
    None,
    /// A temporary error occurred (e.g. DNS timeout).
    TempError,
    /// A permanent error in the SPF record (e.g. syntax error).
    PermError,
}

/// SPF record checker.
///
/// Evaluates SPF policy by parsing TXT records and matching mechanisms against
/// the sender IP address.
///
/// # Examples
///
/// ```no_run
/// use signapps_dkim::{SpfChecker, MockDnsResolver};
/// use std::net::IpAddr;
///
/// # async fn example() {
/// let resolver = MockDnsResolver::new();
/// let ip: IpAddr = "1.2.3.4".parse().unwrap();
/// let result = SpfChecker::check(ip, "example.com", "user@example.com", &resolver).await;
/// # }
/// ```
pub struct SpfChecker;

impl SpfChecker {
    /// Evaluate the SPF policy for a given sender.
    ///
    /// # Arguments
    ///
    /// * `sender_ip` — IP address of the sending server
    /// * `helo_domain` — domain from the SMTP HELO/EHLO command
    /// * `mail_from` — RFC 5321 MAIL FROM address (or empty for bounce)
    /// * `dns` — DNS resolver implementation
    ///
    /// # Errors
    ///
    /// This method does not return `Result` — all outcomes are encoded in [`SpfResult`].
    ///
    /// # Panics
    ///
    /// None.
    pub async fn check(
        sender_ip: IpAddr,
        helo_domain: &str,
        mail_from: &str,
        dns: &dyn DnsResolver,
    ) -> SpfResult {
        // Extract the domain from mail_from
        let domain = if mail_from.is_empty() {
            helo_domain
        } else {
            mail_from
                .rsplit_once('@')
                .map(|(_, d)| d)
                .unwrap_or(helo_domain)
        };

        let mut lookup_count = 0;
        Self::evaluate_domain(sender_ip, domain, dns, &mut lookup_count).await
    }

    /// Recursively evaluate SPF for a domain.
    async fn evaluate_domain(
        sender_ip: IpAddr,
        domain: &str,
        dns: &dyn DnsResolver,
        lookup_count: &mut usize,
    ) -> SpfResult {
        *lookup_count += 1;
        if *lookup_count > MAX_DNS_LOOKUPS {
            return SpfResult::PermError;
        }

        // Fetch TXT records
        let txt_records = match dns.txt_lookup(domain).await {
            Ok(records) => records,
            Err(DnsError::NotFound(_)) => return SpfResult::None,
            Err(DnsError::TempError(_)) => return SpfResult::TempError,
        };

        // Find the SPF record
        let spf_record = match find_spf_record(&txt_records) {
            Some(r) => r,
            None => return SpfResult::None,
        };

        // Parse and evaluate mechanisms
        let mechanisms = parse_mechanisms(&spf_record);

        for mechanism in &mechanisms {
            match mechanism {
                Mechanism::All(qualifier) => return qualifier_to_result(*qualifier),
                Mechanism::Ip4(qualifier, network) => {
                    if matches_ip_network(sender_ip, network) {
                        return qualifier_to_result(*qualifier);
                    }
                },
                Mechanism::Ip6(qualifier, network) => {
                    if matches_ip_network(sender_ip, network) {
                        return qualifier_to_result(*qualifier);
                    }
                },
                Mechanism::A(qualifier, target_domain) => {
                    *lookup_count += 1;
                    if *lookup_count > MAX_DNS_LOOKUPS {
                        return SpfResult::PermError;
                    }
                    let target = if target_domain.is_empty() {
                        domain
                    } else {
                        target_domain
                    };
                    if let Ok(ips) = dns.a_lookup(target).await {
                        if ips.contains(&sender_ip) {
                            return qualifier_to_result(*qualifier);
                        }
                    }
                },
                Mechanism::Mx(qualifier, target_domain) => {
                    *lookup_count += 1;
                    if *lookup_count > MAX_DNS_LOOKUPS {
                        return SpfResult::PermError;
                    }
                    let target = if target_domain.is_empty() {
                        domain
                    } else {
                        target_domain
                    };
                    if let Ok(mx_hosts) = dns.mx_lookup(target).await {
                        for mx_host in &mx_hosts {
                            *lookup_count += 1;
                            if *lookup_count > MAX_DNS_LOOKUPS {
                                return SpfResult::PermError;
                            }
                            if let Ok(ips) = dns.a_lookup(mx_host).await {
                                if ips.contains(&sender_ip) {
                                    return qualifier_to_result(*qualifier);
                                }
                            }
                        }
                    }
                },
                Mechanism::Include(qualifier, include_domain) => {
                    let sub_result = Box::pin(Self::evaluate_domain(
                        sender_ip,
                        include_domain,
                        dns,
                        lookup_count,
                    ))
                    .await;
                    match sub_result {
                        SpfResult::Pass => return qualifier_to_result(*qualifier),
                        SpfResult::TempError => return SpfResult::TempError,
                        SpfResult::PermError => return SpfResult::PermError,
                        _ => {}, // continue checking other mechanisms
                    }
                },
                Mechanism::Redirect(target_domain) => {
                    return Box::pin(Self::evaluate_domain(
                        sender_ip,
                        target_domain,
                        dns,
                        lookup_count,
                    ))
                    .await;
                },
            }
        }

        // Default result when no mechanism matches (RFC 7208 §4.7)
        SpfResult::Neutral
    }
}

/// Qualifier prefix for SPF mechanisms.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Qualifier {
    Pass,     // + (default)
    Fail,     // -
    SoftFail, // ~
    Neutral,  // ?
}

/// Parsed SPF mechanism.
#[derive(Debug, Clone)]
enum Mechanism {
    All(Qualifier),
    Ip4(Qualifier, String),
    Ip6(Qualifier, String),
    A(Qualifier, String),
    Mx(Qualifier, String),
    Include(Qualifier, String),
    Redirect(String),
}

/// Find the SPF TXT record among multiple TXT records.
fn find_spf_record(records: &[String]) -> Option<String> {
    records
        .iter()
        .find(|r| r.starts_with("v=spf1 ") || *r == "v=spf1")
        .cloned()
}

/// Parse SPF mechanisms from the record string.
fn parse_mechanisms(record: &str) -> Vec<Mechanism> {
    let mut mechanisms = Vec::new();

    // Skip the "v=spf1" prefix
    let parts: Vec<&str> = record.split_whitespace().skip(1).collect();

    for part in parts {
        // Parse qualifier
        let (qualifier, term) = match part.as_bytes().first() {
            Some(b'+') => (Qualifier::Pass, &part[1..]),
            Some(b'-') => (Qualifier::Fail, &part[1..]),
            Some(b'~') => (Qualifier::SoftFail, &part[1..]),
            Some(b'?') => (Qualifier::Neutral, &part[1..]),
            _ => (Qualifier::Pass, part),
        };

        if term == "all" {
            mechanisms.push(Mechanism::All(qualifier));
        } else if let Some(network) = term.strip_prefix("ip4:") {
            mechanisms.push(Mechanism::Ip4(qualifier, network.to_string()));
        } else if let Some(network) = term.strip_prefix("ip6:") {
            mechanisms.push(Mechanism::Ip6(qualifier, network.to_string()));
        } else if term == "a" {
            mechanisms.push(Mechanism::A(qualifier, String::new()));
        } else if let Some(domain) = term.strip_prefix("a:") {
            mechanisms.push(Mechanism::A(qualifier, domain.to_string()));
        } else if term == "mx" {
            mechanisms.push(Mechanism::Mx(qualifier, String::new()));
        } else if let Some(domain) = term.strip_prefix("mx:") {
            mechanisms.push(Mechanism::Mx(qualifier, domain.to_string()));
        } else if let Some(domain) = term.strip_prefix("include:") {
            mechanisms.push(Mechanism::Include(qualifier, domain.to_string()));
        } else if let Some(domain) = term.strip_prefix("redirect=") {
            mechanisms.push(Mechanism::Redirect(domain.to_string()));
        }
        // Unknown mechanisms are silently ignored per RFC 7208
    }

    mechanisms
}

/// Check if an IP address matches a CIDR network or single IP.
fn matches_ip_network(ip: IpAddr, network: &str) -> bool {
    // Try parsing as CIDR (e.g., "192.168.1.0/24")
    if let Some((addr_str, prefix_str)) = network.rsplit_once('/') {
        let prefix_len: u32 = match prefix_str.parse() {
            Ok(p) => p,
            Err(_) => return false,
        };

        match (ip, addr_str.parse::<IpAddr>()) {
            (IpAddr::V4(ip_v4), Ok(IpAddr::V4(net_v4))) => {
                if prefix_len > 32 {
                    return false;
                }
                if prefix_len == 0 {
                    return true;
                }
                let mask = u32::MAX << (32 - prefix_len);
                (u32::from(ip_v4) & mask) == (u32::from(net_v4) & mask)
            },
            (IpAddr::V6(ip_v6), Ok(IpAddr::V6(net_v6))) => {
                if prefix_len > 128 {
                    return false;
                }
                if prefix_len == 0 {
                    return true;
                }
                let mask = u128::MAX << (128 - prefix_len);
                (u128::from(ip_v6) & mask) == (u128::from(net_v6) & mask)
            },
            _ => false,
        }
    } else {
        // Single IP address
        match network.parse::<IpAddr>() {
            Ok(net_ip) => ip == net_ip,
            Err(_) => false,
        }
    }
}

/// Convert a qualifier to the corresponding SPF result.
fn qualifier_to_result(qualifier: Qualifier) -> SpfResult {
    match qualifier {
        Qualifier::Pass => SpfResult::Pass,
        Qualifier::Fail => SpfResult::Fail,
        Qualifier::SoftFail => SpfResult::SoftFail,
        Qualifier::Neutral => SpfResult::Neutral,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::MockDnsResolver;

    #[test]
    fn test_find_spf_record() {
        let records = vec![
            "google-site-verification=abc".to_string(),
            "v=spf1 ip4:1.2.3.4 -all".to_string(),
        ];
        let spf = find_spf_record(&records);
        assert_eq!(spf, Some("v=spf1 ip4:1.2.3.4 -all".to_string()));
    }

    #[test]
    fn test_matches_ip_network_exact() {
        let ip: IpAddr = "192.168.1.1".parse().unwrap();
        assert!(matches_ip_network(ip, "192.168.1.1"));
        assert!(!matches_ip_network(ip, "192.168.1.2"));
    }

    #[test]
    fn test_matches_ip_network_cidr() {
        let ip: IpAddr = "192.168.1.100".parse().unwrap();
        assert!(matches_ip_network(ip, "192.168.1.0/24"));
        assert!(!matches_ip_network(ip, "10.0.0.0/8"));
    }

    #[test]
    fn test_matches_ip_network_ipv6_cidr() {
        let ip: IpAddr = "2001:db8::1".parse().unwrap();
        assert!(matches_ip_network(ip, "2001:db8::/32"));
        assert!(!matches_ip_network(ip, "2001:db9::/32"));
    }

    #[tokio::test]
    async fn test_spf_ip4_match_pass() {
        let mut resolver = MockDnsResolver::new();
        resolver.add_txt("example.com", "v=spf1 ip4:1.2.3.4 -all");

        let ip: IpAddr = "1.2.3.4".parse().unwrap();
        let result = SpfChecker::check(ip, "example.com", "user@example.com", &resolver).await;
        assert_eq!(result, SpfResult::Pass);
    }

    #[tokio::test]
    async fn test_spf_ip4_no_match_fail() {
        let mut resolver = MockDnsResolver::new();
        resolver.add_txt("example.com", "v=spf1 ip4:1.2.3.4 -all");

        let ip: IpAddr = "5.6.7.8".parse().unwrap();
        let result = SpfChecker::check(ip, "example.com", "user@example.com", &resolver).await;
        assert_eq!(result, SpfResult::Fail);
    }

    #[tokio::test]
    async fn test_spf_cidr_match() {
        let mut resolver = MockDnsResolver::new();
        resolver.add_txt("example.com", "v=spf1 ip4:10.0.0.0/8 -all");

        let ip: IpAddr = "10.1.2.3".parse().unwrap();
        let result = SpfChecker::check(ip, "example.com", "user@example.com", &resolver).await;
        assert_eq!(result, SpfResult::Pass);
    }

    #[tokio::test]
    async fn test_spf_softfail() {
        let mut resolver = MockDnsResolver::new();
        resolver.add_txt("example.com", "v=spf1 ip4:1.2.3.4 ~all");

        let ip: IpAddr = "5.6.7.8".parse().unwrap();
        let result = SpfChecker::check(ip, "example.com", "user@example.com", &resolver).await;
        assert_eq!(result, SpfResult::SoftFail);
    }

    #[tokio::test]
    async fn test_spf_no_record() {
        let resolver = MockDnsResolver::new();

        let ip: IpAddr = "1.2.3.4".parse().unwrap();
        let result = SpfChecker::check(ip, "example.com", "user@example.com", &resolver).await;
        assert_eq!(result, SpfResult::None);
    }

    #[tokio::test]
    async fn test_spf_include_mechanism() {
        let mut resolver = MockDnsResolver::new();
        resolver.add_txt("example.com", "v=spf1 include:_spf.google.com -all");
        resolver.add_txt("_spf.google.com", "v=spf1 ip4:172.217.0.0/16 -all");

        let ip: IpAddr = "172.217.1.1".parse().unwrap();
        let result = SpfChecker::check(ip, "example.com", "user@example.com", &resolver).await;
        assert_eq!(result, SpfResult::Pass);
    }

    #[tokio::test]
    async fn test_spf_a_mechanism() {
        let mut resolver = MockDnsResolver::new();
        resolver.add_txt("example.com", "v=spf1 a -all");
        resolver.add_a("example.com", "93.184.216.34".parse().unwrap());

        let ip: IpAddr = "93.184.216.34".parse().unwrap();
        let result = SpfChecker::check(ip, "example.com", "user@example.com", &resolver).await;
        assert_eq!(result, SpfResult::Pass);
    }
}
