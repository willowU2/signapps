//! Spam scoring pipeline.
//!
//! Aggregates scores from DNSBL checks, authentication results (SPF/DKIM/DMARC),
//! header analysis, and body heuristics into a single [`SpamVerdict`].

use serde::{Deserialize, Serialize};
use std::net::IpAddr;

use crate::dnsbl::DnsBlResolver;
use crate::headers;

/// Configuration for the spam scoring engine.
///
/// # Examples
///
/// ```
/// use signapps_spam::SpamConfig;
/// let config = SpamConfig::default();
/// assert!(config.ham_threshold < config.quarantine_threshold);
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpamConfig {
    /// DNS blacklist servers to query (e.g. `["zen.spamhaus.org"]`).
    pub dnsbl_servers: Vec<String>,
    /// Whether greylisting is enabled.
    pub greylisting_enabled: bool,
    /// Score below which a message is accepted as ham.
    pub ham_threshold: f32,
    /// Score at or above which a message is quarantined.
    pub quarantine_threshold: f32,
    /// Score at or above which a message is rejected.
    pub reject_threshold: f32,
}

impl Default for SpamConfig {
    fn default() -> Self {
        Self {
            dnsbl_servers: vec![
                "zen.spamhaus.org".to_string(),
                "b.barracudacentral.org".to_string(),
            ],
            greylisting_enabled: false,
            ham_threshold: 3.0,
            quarantine_threshold: 6.0,
            reject_threshold: 10.0,
        }
    }
}

/// Context about the SMTP session used for spam scoring.
///
/// Populated from the SMTP envelope and authentication check results
/// before calling [`SpamChecker::check`].
///
/// # Examples
///
/// ```
/// use signapps_spam::SpamContext;
/// let ctx = SpamContext {
///     sender_ip: "1.2.3.4".parse().unwrap(),
///     helo_domain: "mx.example.com".to_string(),
///     mail_from: "user@example.com".to_string(),
///     recipients: vec!["dest@local.com".to_string()],
///     spf_result: "pass".to_string(),
///     dkim_result: "pass".to_string(),
///     dmarc_result: "pass".to_string(),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpamContext {
    /// IP address of the sending MTA.
    pub sender_ip: IpAddr,
    /// Domain used in EHLO/HELO.
    pub helo_domain: String,
    /// Envelope MAIL FROM address.
    pub mail_from: String,
    /// Envelope RCPT TO addresses.
    pub recipients: Vec<String>,
    /// SPF check result: `"pass"`, `"fail"`, `"softfail"`, or `"none"`.
    pub spf_result: String,
    /// DKIM check result: `"pass"`, `"fail"`, or `"none"`.
    pub dkim_result: String,
    /// DMARC check result: `"pass"`, `"fail"`, or `"none"`.
    pub dmarc_result: String,
}

/// Final spam verdict for a message.
///
/// Contains the aggregate score, the individual tests that contributed,
/// and the recommended action.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpamVerdict {
    /// Aggregate spam score.
    pub score: f32,
    /// Individual tests that contributed to the score.
    pub tests: Vec<SpamTest>,
    /// Recommended action based on the score and thresholds.
    pub action: SpamAction,
}

/// A single spam test that contributed to the overall score.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpamTest {
    /// Short identifier for the test (e.g. `"DNSBL_HIT"`).
    pub name: String,
    /// Score contribution (positive = spammy).
    pub score: f32,
    /// Human-readable description of why this test fired.
    pub description: String,
}

/// Action to take on a message based on the spam verdict.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SpamAction {
    /// Deliver normally (ham).
    Accept,
    /// Deliver to quarantine / Junk folder.
    Quarantine,
    /// Reject with an SMTP error message.
    Reject(String),
}

/// The spam checker engine.
///
/// Runs a scoring pipeline against message headers, body, and SMTP context.
///
/// # Examples
///
/// ```
/// use signapps_spam::{SpamChecker, SpamConfig, SpamContext, SpamAction};
///
/// let checker = SpamChecker::new(SpamConfig::default());
/// let ctx = SpamContext {
///     sender_ip: "127.0.0.1".parse().unwrap(),
///     helo_domain: "example.com".to_string(),
///     mail_from: "test@example.com".to_string(),
///     recipients: vec!["user@local.com".to_string()],
///     spf_result: "pass".to_string(),
///     dkim_result: "pass".to_string(),
///     dmarc_result: "pass".to_string(),
/// };
/// let verdict = checker.check_sync(&[], "", &ctx);
/// assert!(matches!(verdict.action, SpamAction::Accept));
/// ```
pub struct SpamChecker {
    config: SpamConfig,
}

impl SpamChecker {
    /// Create a new spam checker with the given configuration.
    pub fn new(config: SpamConfig) -> Self {
        Self { config }
    }

    /// Check a message for spam (async — includes DNSBL lookups).
    ///
    /// # Arguments
    ///
    /// * `headers` — Message headers as `(name, value)` pairs.
    /// * `body` — The plain-text body of the message.
    /// * `ctx` — SMTP session context (sender IP, auth results, etc.).
    /// * `resolver` — DNS resolver for DNSBL lookups.
    ///
    /// # Errors
    ///
    /// This method does not return errors — DNS failures are treated as
    /// non-hits (score 0 for that DNSBL).
    ///
    /// # Panics
    ///
    /// None.
    pub async fn check<R: DnsBlResolver>(
        &self,
        headers: &[(String, String)],
        body: &str,
        ctx: &SpamContext,
        resolver: &R,
    ) -> SpamVerdict {
        let mut tests = Vec::new();

        // 1. DNSBL checks
        let dnsbl_tests =
            crate::dnsbl::check_dnsbl(&ctx.sender_ip, &self.config.dnsbl_servers, resolver).await;
        tests.extend(dnsbl_tests);

        // 2. Authentication checks
        tests.extend(check_auth(ctx));

        // 3. Header analysis
        tests.extend(headers::analyze_headers(headers, &ctx.mail_from));

        // 4. Body heuristics
        tests.extend(check_body(body));

        self.build_verdict(tests)
    }

    /// Check a message for spam (synchronous — no DNSBL lookups).
    ///
    /// Useful when DNSBL checks are not desired or have already been performed.
    ///
    /// # Panics
    ///
    /// None.
    pub fn check_sync(
        &self,
        headers: &[(String, String)],
        body: &str,
        ctx: &SpamContext,
    ) -> SpamVerdict {
        let mut tests = Vec::new();

        // Authentication checks
        tests.extend(check_auth(ctx));

        // Header analysis
        tests.extend(headers::analyze_headers(headers, &ctx.mail_from));

        // Body heuristics
        tests.extend(check_body(body));

        self.build_verdict(tests)
    }

    /// Build the final verdict from accumulated test results.
    fn build_verdict(&self, tests: Vec<SpamTest>) -> SpamVerdict {
        let score: f32 = tests.iter().map(|t| t.score).sum();
        let action = if score >= self.config.reject_threshold {
            SpamAction::Reject(format!(
                "Message rejected: spam score {:.1} exceeds threshold",
                score
            ))
        } else if score >= self.config.quarantine_threshold {
            SpamAction::Quarantine
        } else {
            SpamAction::Accept
        };
        SpamVerdict {
            score,
            tests,
            action,
        }
    }
}

/// Check SPF, DKIM, and DMARC authentication results.
fn check_auth(ctx: &SpamContext) -> Vec<SpamTest> {
    let mut tests = Vec::new();

    // SPF
    match ctx.spf_result.to_lowercase().as_str() {
        "fail" => tests.push(SpamTest {
            name: "SPF_FAIL".to_string(),
            score: 3.0,
            description: "SPF authentication failed".to_string(),
        }),
        "softfail" => tests.push(SpamTest {
            name: "SPF_SOFTFAIL".to_string(),
            score: 1.0,
            description: "SPF soft-fail (sender IP not authorized)".to_string(),
        }),
        _ => {}, // pass or none — no penalty
    }

    // DKIM
    if ctx.dkim_result.to_lowercase() == "fail" {
        tests.push(SpamTest {
            name: "DKIM_FAIL".to_string(),
            score: 3.0,
            description: "DKIM signature verification failed".to_string(),
        });
    }

    // DMARC
    if ctx.dmarc_result.to_lowercase() == "fail" {
        tests.push(SpamTest {
            name: "DMARC_FAIL".to_string(),
            score: 4.0,
            description: "DMARC policy check failed".to_string(),
        });
    }

    tests
}

/// Check body content heuristics.
fn check_body(body: &str) -> Vec<SpamTest> {
    let mut tests = Vec::new();

    // Very short body
    let trimmed = body.trim();
    if !trimmed.is_empty() && trimmed.len() < 10 {
        tests.push(SpamTest {
            name: "SHORT_BODY".to_string(),
            score: 1.0,
            description: "Message body is suspiciously short (<10 characters)".to_string(),
        });
    }

    // Newsletter pattern detection: "unsubscribe" + many URLs → no penalty
    // (We only add negative signals for spam, newsletters are neutral.)

    tests
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_ctx() -> SpamContext {
        SpamContext {
            sender_ip: "192.168.1.1".parse().unwrap(),
            helo_domain: "mail.example.com".to_string(),
            mail_from: "sender@example.com".to_string(),
            recipients: vec!["user@local.com".to_string()],
            spf_result: "pass".to_string(),
            dkim_result: "pass".to_string(),
            dmarc_result: "pass".to_string(),
        }
    }

    #[test]
    fn test_clean_message_accepted() {
        let checker = SpamChecker::new(SpamConfig::default());
        let ctx = default_ctx();
        let verdict = checker.check_sync(&[], "Hello, this is a normal message.", &ctx);
        assert!(matches!(verdict.action, SpamAction::Accept));
        assert!(verdict.score < 3.0);
    }

    #[test]
    fn test_spf_fail_adds_score() {
        let checker = SpamChecker::new(SpamConfig::default());
        let mut ctx = default_ctx();
        ctx.spf_result = "fail".to_string();
        let verdict = checker.check_sync(&[], "Normal body content here.", &ctx);
        assert!(verdict.tests.iter().any(|t| t.name == "SPF_FAIL"));
        assert!(verdict.score >= 3.0);
    }

    #[test]
    fn test_spf_softfail_adds_score() {
        let checker = SpamChecker::new(SpamConfig::default());
        let mut ctx = default_ctx();
        ctx.spf_result = "softfail".to_string();
        let verdict = checker.check_sync(&[], "Normal body content here.", &ctx);
        assert!(verdict.tests.iter().any(|t| t.name == "SPF_SOFTFAIL"));
        assert!(verdict.score >= 1.0);
    }

    #[test]
    fn test_dkim_fail_adds_score() {
        let checker = SpamChecker::new(SpamConfig::default());
        let mut ctx = default_ctx();
        ctx.dkim_result = "fail".to_string();
        let verdict = checker.check_sync(&[], "Normal body content here.", &ctx);
        assert!(verdict.tests.iter().any(|t| t.name == "DKIM_FAIL"));
        assert!(verdict.score >= 3.0);
    }

    #[test]
    fn test_dmarc_fail_adds_score() {
        let checker = SpamChecker::new(SpamConfig::default());
        let mut ctx = default_ctx();
        ctx.dmarc_result = "fail".to_string();
        let verdict = checker.check_sync(&[], "Normal body content here.", &ctx);
        assert!(verdict.tests.iter().any(|t| t.name == "DMARC_FAIL"));
        assert!(verdict.score >= 4.0);
    }

    #[test]
    fn test_all_auth_fail_quarantine() {
        let checker = SpamChecker::new(SpamConfig::default());
        let mut ctx = default_ctx();
        ctx.spf_result = "fail".to_string();
        ctx.dkim_result = "fail".to_string();
        // SPF_FAIL(3) + DKIM_FAIL(3) = 6 → quarantine threshold
        let verdict = checker.check_sync(&[], "Normal body content.", &ctx);
        assert!(matches!(
            verdict.action,
            SpamAction::Quarantine | SpamAction::Reject(_)
        ));
    }

    #[test]
    fn test_all_auth_fail_plus_dmarc_reject() {
        let checker = SpamChecker::new(SpamConfig::default());
        let mut ctx = default_ctx();
        ctx.spf_result = "fail".to_string();
        ctx.dkim_result = "fail".to_string();
        ctx.dmarc_result = "fail".to_string();
        // SPF_FAIL(3) + DKIM_FAIL(3) + DMARC_FAIL(4) = 10 → reject threshold
        let verdict = checker.check_sync(&[], "Normal body content.", &ctx);
        assert!(matches!(verdict.action, SpamAction::Reject(_)));
    }

    #[test]
    fn test_short_body_adds_score() {
        let checker = SpamChecker::new(SpamConfig::default());
        let ctx = default_ctx();
        let verdict = checker.check_sync(&[], "Hi", &ctx);
        assert!(verdict.tests.iter().any(|t| t.name == "SHORT_BODY"));
    }

    #[test]
    fn test_empty_body_no_short_body_penalty() {
        let checker = SpamChecker::new(SpamConfig::default());
        let ctx = default_ctx();
        let verdict = checker.check_sync(&[], "", &ctx);
        assert!(!verdict.tests.iter().any(|t| t.name == "SHORT_BODY"));
    }

    #[test]
    fn test_missing_headers_scoring() {
        let checker = SpamChecker::new(SpamConfig::default());
        let ctx = default_ctx();
        // No Date, no Message-ID
        let headers = vec![
            ("From".to_string(), "sender@example.com".to_string()),
            ("Subject".to_string(), "Test".to_string()),
        ];
        let verdict = checker.check_sync(&headers, "Normal body text.", &ctx);
        assert!(verdict.tests.iter().any(|t| t.name == "MISSING_DATE"));
        assert!(verdict.tests.iter().any(|t| t.name == "MISSING_MESSAGE_ID"));
    }

    #[test]
    fn test_forged_from_scoring() {
        let checker = SpamChecker::new(SpamConfig::default());
        let ctx = SpamContext {
            sender_ip: "192.168.1.1".parse().unwrap(),
            helo_domain: "mail.example.com".to_string(),
            mail_from: "sender@example.com".to_string(),
            recipients: vec!["user@local.com".to_string()],
            spf_result: "pass".to_string(),
            dkim_result: "pass".to_string(),
            dmarc_result: "pass".to_string(),
        };
        // Display name contains email from a different domain → forged
        let headers = vec![
            (
                "From".to_string(),
                "admin@paypal.com <phisher@evil.com>".to_string(),
            ),
            (
                "Date".to_string(),
                "Thu, 1 Jan 2026 00:00:00 +0000".to_string(),
            ),
            ("Message-ID".to_string(), "<abc@example.com>".to_string()),
        ];
        let verdict = checker.check_sync(&headers, "Click here to verify.", &ctx);
        assert!(verdict.tests.iter().any(|t| t.name == "FORGED_FROM"));
    }
}
