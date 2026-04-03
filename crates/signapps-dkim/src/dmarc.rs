//! DMARC policy parser and evaluator (RFC 7489).
//!
//! Evaluates DMARC alignment by combining DKIM and SPF results
//! and applying the domain's published policy.

use crate::spf::SpfResult;
use crate::verify::DkimResult;
use crate::DnsResolver;

/// DMARC disposition — the action the receiver should take.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DmarcDisposition {
    /// No specific action requested (monitor mode).
    None,
    /// Message should be treated as suspicious (e.g. move to spam).
    Quarantine,
    /// Message should be rejected outright.
    Reject,
}

/// Result of a DMARC evaluation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DmarcResult {
    /// The recommended disposition based on the DMARC policy.
    pub disposition: DmarcDisposition,
    /// Whether DKIM is aligned (signing domain matches From domain).
    pub dkim_aligned: bool,
    /// Whether SPF is aligned (envelope domain matches From domain).
    pub spf_aligned: bool,
    /// The raw policy string from the DMARC record (e.g. `"reject"`).
    pub policy: String,
}

/// DMARC policy evaluator.
///
/// Combines SPF and DKIM results with domain alignment to determine the
/// recommended message disposition.
///
/// # Examples
///
/// ```no_run
/// use signapps_dkim::{DmarcChecker, MockDnsResolver, SpfResult};
/// use signapps_dkim::DkimResult;
///
/// # async fn example() {
/// let resolver = MockDnsResolver::new();
/// let result = DmarcChecker::evaluate(
///     "example.com",
///     &SpfResult::Pass,
///     "example.com",
///     &DkimResult::Pass { domain: "example.com".into(), selector: "sel".into() },
///     &resolver,
/// ).await;
/// # }
/// ```
pub struct DmarcChecker;

impl DmarcChecker {
    /// Evaluate DMARC policy for a message.
    ///
    /// # Arguments
    ///
    /// * `from_domain` — the domain from the RFC 5322 From header
    /// * `spf_result` — the SPF check result
    /// * `spf_domain` — the domain that SPF was evaluated against (envelope sender)
    /// * `dkim_result` — the DKIM verification result
    /// * `dns` — DNS resolver implementation
    ///
    /// # Errors
    ///
    /// This method does not return `Result` — all outcomes are encoded in [`DmarcResult`].
    ///
    /// # Panics
    ///
    /// None.
    pub async fn evaluate(
        from_domain: &str,
        spf_result: &SpfResult,
        spf_domain: &str,
        dkim_result: &DkimResult,
        dns: &dyn DnsResolver,
    ) -> DmarcResult {
        // Fetch DMARC record
        let dmarc_domain = format!("_dmarc.{from_domain}");
        let policy = match dns.txt_lookup(&dmarc_domain).await {
            Ok(records) => parse_dmarc_record(&records),
            Err(_) => {
                // No DMARC record — default to none
                return DmarcResult {
                    disposition: DmarcDisposition::None,
                    dkim_aligned: false,
                    spf_aligned: false,
                    policy: "none".to_string(),
                };
            },
        };

        // Check DKIM alignment (relaxed by default)
        let dkim_aligned = match dkim_result {
            DkimResult::Pass { domain, .. } => is_aligned(domain, from_domain, policy.adkim_strict),
            _ => false,
        };

        // Check SPF alignment (relaxed by default)
        let spf_aligned = *spf_result == SpfResult::Pass
            && is_aligned(spf_domain, from_domain, policy.aspf_strict);

        // Determine disposition
        let disposition = if dkim_aligned || spf_aligned {
            // At least one mechanism is aligned and passing
            DmarcDisposition::None
        } else {
            // Neither aligned — apply the published policy
            match policy.policy.as_str() {
                "reject" => DmarcDisposition::Reject,
                "quarantine" => DmarcDisposition::Quarantine,
                _ => DmarcDisposition::None,
            }
        };

        DmarcResult {
            disposition,
            dkim_aligned,
            spf_aligned,
            policy: policy.policy,
        }
    }
}

/// Parsed DMARC policy record.
#[derive(Debug)]
struct DmarcPolicy {
    /// The `p=` value (none, quarantine, reject).
    policy: String,
    /// Whether DKIM alignment is strict (`adkim=s`). Default is relaxed.
    adkim_strict: bool,
    /// Whether SPF alignment is strict (`aspf=s`). Default is relaxed.
    aspf_strict: bool,
}

/// Parse DMARC tags from DNS TXT records.
fn parse_dmarc_record(records: &[String]) -> DmarcPolicy {
    let mut policy = DmarcPolicy {
        policy: "none".to_string(),
        adkim_strict: false,
        aspf_strict: false,
    };

    // Find the DMARC record
    let dmarc_record = records.iter().find(|r| r.starts_with("v=DMARC1"));

    let record = match dmarc_record {
        Some(r) => r,
        None => return policy,
    };

    // Parse tag=value pairs
    for pair in record.split(';') {
        let pair = pair.trim();
        if let Some((tag, value)) = pair.split_once('=') {
            let tag = tag.trim();
            let value = value.trim();
            match tag {
                "p" => policy.policy = value.to_lowercase(),
                "adkim" => policy.adkim_strict = value == "s",
                "aspf" => policy.aspf_strict = value == "s",
                _ => {}, // Ignore other tags (sp, pct, rua, ruf, etc.)
            }
        }
    }

    policy
}

/// Check domain alignment.
///
/// In **relaxed** mode, the organizational domains must match (e.g. `mail.example.com`
/// aligns with `example.com`).
/// In **strict** mode, the domains must be identical.
fn is_aligned(auth_domain: &str, from_domain: &str, strict: bool) -> bool {
    let auth_lower = auth_domain.to_lowercase();
    let from_lower = from_domain.to_lowercase();

    if strict {
        auth_lower == from_lower
    } else {
        // Relaxed: organizational domain match
        // Either must be equal, or one must be a subdomain of the other
        auth_lower == from_lower
            || auth_lower.ends_with(&format!(".{from_lower}"))
            || from_lower.ends_with(&format!(".{auth_lower}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::MockDnsResolver;

    #[test]
    fn test_is_aligned_relaxed() {
        assert!(is_aligned("example.com", "example.com", false));
        assert!(is_aligned("mail.example.com", "example.com", false));
        assert!(!is_aligned("example.org", "example.com", false));
    }

    #[test]
    fn test_is_aligned_strict() {
        assert!(is_aligned("example.com", "example.com", true));
        assert!(!is_aligned("mail.example.com", "example.com", true));
    }

    #[test]
    fn test_parse_dmarc_record() {
        let records = vec!["v=DMARC1; p=reject; adkim=s; aspf=r".to_string()];
        let policy = parse_dmarc_record(&records);
        assert_eq!(policy.policy, "reject");
        assert!(policy.adkim_strict);
        assert!(!policy.aspf_strict);
    }

    #[test]
    fn test_parse_dmarc_record_quarantine() {
        let records = vec!["v=DMARC1; p=quarantine".to_string()];
        let policy = parse_dmarc_record(&records);
        assert_eq!(policy.policy, "quarantine");
        assert!(!policy.adkim_strict);
        assert!(!policy.aspf_strict);
    }

    #[tokio::test]
    async fn test_dmarc_pass_both_aligned() {
        let mut resolver = MockDnsResolver::new();
        resolver.add_txt("_dmarc.example.com", "v=DMARC1; p=reject");

        let result = DmarcChecker::evaluate(
            "example.com",
            &SpfResult::Pass,
            "example.com",
            &DkimResult::Pass {
                domain: "example.com".to_string(),
                selector: "sel".to_string(),
            },
            &resolver,
        )
        .await;

        assert_eq!(result.disposition, DmarcDisposition::None);
        assert!(result.dkim_aligned);
        assert!(result.spf_aligned);
    }

    #[tokio::test]
    async fn test_dmarc_both_fail_reject() {
        let mut resolver = MockDnsResolver::new();
        resolver.add_txt("_dmarc.example.com", "v=DMARC1; p=reject");

        let result = DmarcChecker::evaluate(
            "example.com",
            &SpfResult::Fail,
            "other.com",
            &DkimResult::Fail {
                reason: "bad sig".to_string(),
            },
            &resolver,
        )
        .await;

        assert_eq!(result.disposition, DmarcDisposition::Reject);
        assert!(!result.dkim_aligned);
        assert!(!result.spf_aligned);
        assert_eq!(result.policy, "reject");
    }

    #[tokio::test]
    async fn test_dmarc_spf_pass_dkim_fail_still_passes() {
        let mut resolver = MockDnsResolver::new();
        resolver.add_txt("_dmarc.example.com", "v=DMARC1; p=reject");

        let result = DmarcChecker::evaluate(
            "example.com",
            &SpfResult::Pass,
            "example.com",
            &DkimResult::Fail {
                reason: "bad sig".to_string(),
            },
            &resolver,
        )
        .await;

        // SPF is aligned and passing — DMARC should not reject
        assert_eq!(result.disposition, DmarcDisposition::None);
        assert!(!result.dkim_aligned);
        assert!(result.spf_aligned);
    }

    #[tokio::test]
    async fn test_dmarc_no_record() {
        let resolver = MockDnsResolver::new();

        let result = DmarcChecker::evaluate(
            "example.com",
            &SpfResult::Pass,
            "example.com",
            &DkimResult::None,
            &resolver,
        )
        .await;

        assert_eq!(result.disposition, DmarcDisposition::None);
        assert_eq!(result.policy, "none");
    }

    #[tokio::test]
    async fn test_dmarc_quarantine_policy() {
        let mut resolver = MockDnsResolver::new();
        resolver.add_txt("_dmarc.example.com", "v=DMARC1; p=quarantine");

        let result = DmarcChecker::evaluate(
            "example.com",
            &SpfResult::Fail,
            "other.com",
            &DkimResult::None,
            &resolver,
        )
        .await;

        assert_eq!(result.disposition, DmarcDisposition::Quarantine);
    }
}
