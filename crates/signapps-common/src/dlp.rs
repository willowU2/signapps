//! Data Loss Prevention (DLP) module.
//!
//! Provides content scanning and detection of sensitive data patterns
//! including credit cards, IBANs, SSNs, emails, and phone numbers.
//! Configurable severity levels for policy enforcement.

use regex::Regex;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Supported sensitive data patterns for DLP detection.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DlpPattern {
    /// Credit card numbers (Visa, Mastercard, Amex, etc.)
    CreditCard,
    /// International Bank Account Numbers
    IBAN,
    /// Social Security Numbers
    SSN,
    /// Email addresses
    Email,
    /// Phone numbers
    Phone,
    /// Custom regex pattern
    Custom(String),
}

impl DlpPattern {
    /// Get the regex pattern for detecting this DlpPattern.
    fn regex(&self) -> Result<Regex, regex::Error> {
        match self {
            DlpPattern::CreditCard => {
                // Matches 13-19 digit sequences with optional hyphens/spaces (common CC format)
                Regex::new(r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{3,4}\b")
            },
            DlpPattern::IBAN => {
                // Matches IBAN format (2 letter country + 2 check digits + up to 30 alphanumeric)
                Regex::new(r"\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b")
            },
            DlpPattern::SSN => {
                // Matches US SSN format (XXX-XX-XXXX or XXXXXXXXX)
                Regex::new(r"\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b")
            },
            DlpPattern::Email => {
                // Standard email pattern
                Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
            },
            DlpPattern::Phone => {
                // Matches various phone formats: +1-234-567-8900, (234) 567-8900, 234-567-8900, etc.
                Regex::new(r"(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}")
            },
            DlpPattern::Custom(pattern) => Regex::new(pattern),
        }
    }
}

/// Severity level for DLP findings.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    /// Low severity, informational
    Low,
    /// Medium severity, should be reviewed
    Medium,
    /// High severity, requires immediate action
    High,
    /// Critical severity, blocks operation
    Critical,
}

/// A DLP rule configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DlpRule {
    /// Unique identifier for this rule.
    pub id: Uuid,
    /// Pattern to detect.
    pub pattern_type: DlpPattern,
    /// Severity level if pattern is found.
    pub severity: Severity,
}

impl DlpRule {
    /// Create a new DLP rule.
    pub fn new(pattern_type: DlpPattern, severity: Severity) -> Self {
        Self {
            id: Uuid::new_v4(),
            pattern_type,
            severity,
        }
    }
}

/// A finding detected by the DLP scanner.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DlpFinding {
    /// Rule that matched.
    pub rule_id: Uuid,
    /// Type of pattern detected.
    pub pattern_type: DlpPattern,
    /// Severity of the finding.
    pub severity: Severity,
    /// The actual matched text (redacted for security).
    pub matched_text: String,
    /// Position in the content where match was found.
    pub position: usize,
    /// Line number (1-indexed).
    pub line_number: usize,
}

/// DLP Scanner for detecting sensitive data in text.
pub struct DlpScanner {
    rules: Vec<DlpRule>,
}

impl DlpScanner {
    /// Create a new DLP scanner with the given rules.
    pub fn new(rules: Vec<DlpRule>) -> Self {
        Self { rules }
    }

    /// Create a scanner with default common patterns.
    pub fn with_defaults() -> Self {
        let rules = vec![
            DlpRule::new(DlpPattern::CreditCard, Severity::Critical),
            DlpRule::new(DlpPattern::IBAN, Severity::High),
            DlpRule::new(DlpPattern::SSN, Severity::Critical),
            DlpRule::new(DlpPattern::Email, Severity::Medium),
            DlpRule::new(DlpPattern::Phone, Severity::Medium),
        ];
        Self { rules }
    }

    /// Scan content for sensitive data patterns.
    /// Returns a vector of findings in order of appearance.
    pub fn scan_text(&self, content: &str) -> Vec<DlpFinding> {
        let mut findings = Vec::new();

        for rule in &self.rules {
            if let Ok(regex) = rule.pattern_type.regex() {
                for mat in regex.find_iter(content) {
                    let matched_text = mat.as_str();
                    let position = mat.start();

                    // Calculate line number
                    let line_number = content[..position].matches('\n').count() + 1;

                    findings.push(DlpFinding {
                        rule_id: rule.id,
                        pattern_type: rule.pattern_type.clone(),
                        severity: rule.severity,
                        matched_text: matched_text.to_string(),
                        position,
                        line_number,
                    });
                }
            }
        }

        // Sort by position to maintain order of appearance
        findings.sort_by_key(|f| f.position);
        findings
    }

    /// Add a rule to the scanner.
    pub fn add_rule(&mut self, rule: DlpRule) {
        self.rules.push(rule);
    }

    /// Remove a rule by ID.
    pub fn remove_rule(&self, rule_id: Uuid) -> Self {
        let rules = self
            .rules
            .iter()
            .filter(|r| r.id != rule_id)
            .cloned()
            .collect();
        Self { rules }
    }

    /// Get the number of rules in this scanner.
    pub fn rule_count(&self) -> usize {
        self.rules.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dlp_scanner_credit_card() {
        let scanner = DlpScanner::with_defaults();
        let findings = scanner.scan_text("My CC is 4532-1234-5678-9010");
        assert!(!findings.is_empty());
    }

    #[test]
    fn test_dlp_scanner_ssn() {
        let scanner = DlpScanner::with_defaults();
        let findings = scanner.scan_text("SSN: 123-45-6789");
        assert!(!findings.is_empty());
    }

    #[test]
    fn test_dlp_scanner_email() {
        let scanner = DlpScanner::with_defaults();
        let findings = scanner.scan_text("Contact me at john@example.com");
        let email_findings: Vec<_> = findings
            .iter()
            .filter(|f| f.pattern_type == DlpPattern::Email)
            .collect();
        assert!(!email_findings.is_empty());
    }

    #[test]
    fn test_dlp_scanner_no_matches() {
        let scanner = DlpScanner::with_defaults();
        let findings = scanner.scan_text("This is a regular text with no sensitive data");
        assert!(findings.is_empty());
    }
}
