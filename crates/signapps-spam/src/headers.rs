//! Header analysis for spam scoring.
//!
//! Checks for missing required headers (Date, Message-ID) and signs of
//! forged sender addresses (display name domain vs. actual email domain).

use crate::scorer::SpamTest;

/// Analyze message headers for spam indicators.
///
/// # Checks performed
///
/// - **MISSING_DATE** (+1): RFC 5322 requires a `Date` header.
/// - **MISSING_MESSAGE_ID** (+1): RFC 5322 requires a `Message-ID` header.
/// - **FORGED_FROM** (+2): Display name in `From` contains an email-like
///   pattern from a different domain than the actual sender address.
///
/// # Arguments
///
/// * `headers` — Message headers as `(name, value)` pairs.
/// * `mail_from` — Envelope MAIL FROM address for domain comparison.
///
/// # Panics
///
/// None.
pub fn analyze_headers(headers: &[(String, String)], mail_from: &str) -> Vec<SpamTest> {
    let mut tests = Vec::new();

    // Only check if we have headers to analyze (empty = no header data available)
    if headers.is_empty() {
        return tests;
    }

    let has_date = headers
        .iter()
        .any(|(name, _)| name.eq_ignore_ascii_case("Date"));
    let has_message_id = headers
        .iter()
        .any(|(name, _)| name.eq_ignore_ascii_case("Message-ID"));

    if !has_date {
        tests.push(SpamTest {
            name: "MISSING_DATE".to_string(),
            score: 1.0,
            description: "Message is missing the required Date header".to_string(),
        });
    }

    if !has_message_id {
        tests.push(SpamTest {
            name: "MISSING_MESSAGE_ID".to_string(),
            score: 1.0,
            description: "Message is missing the required Message-ID header".to_string(),
        });
    }

    // Check for forged From header
    if let Some((_, from_value)) = headers
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case("From"))
    {
        if is_forged_from(from_value, mail_from) {
            tests.push(SpamTest {
                name: "FORGED_FROM".to_string(),
                score: 2.0,
                description: "From header display name domain differs from sender email domain"
                    .to_string(),
            });
        }
    }

    tests
}

/// Check if a From header value appears forged.
///
/// A From is considered forged when the display name portion contains what
/// looks like an email address from a different domain than the actual sender.
///
/// Example: `"PayPal Security <phisher@evil.com>"` — the display name suggests
/// PayPal, but the actual address is from `evil.com`.
///
/// # Panics
///
/// None.
fn is_forged_from(from_value: &str, _mail_from: &str) -> bool {
    // Extract the email address from the From header
    let actual_email = if let Some(start) = from_value.find('<') {
        if let Some(end) = from_value.find('>') {
            &from_value[start + 1..end]
        } else {
            return false;
        }
    } else {
        return false; // No angle brackets — can't determine display name
    };

    // Extract display name (everything before the '<')
    let display_name = from_value[..from_value.find('<').unwrap_or(0)].trim();
    if display_name.is_empty() {
        return false;
    }

    // Get the domain of the actual email
    let actual_domain = match actual_email.rsplit_once('@') {
        Some((_, domain)) => domain.to_lowercase(),
        None => return false,
    };

    // Check if the display name contains an email-like pattern
    // from a different domain
    if let Some(at_pos) = display_name.find('@') {
        let display_domain = display_name[at_pos + 1..]
            .trim_end_matches(|c: char| !c.is_alphanumeric() && c != '.' && c != '-')
            .to_lowercase();
        if !display_domain.is_empty() && display_domain != actual_domain {
            return true;
        }
    }

    // Check if display name contains a well-known brand-like domain
    // that doesn't match the actual sender domain
    let display_lower = display_name.to_lowercase();
    let brand_domains = [
        ("paypal", "paypal.com"),
        ("amazon", "amazon.com"),
        ("apple", "apple.com"),
        ("microsoft", "microsoft.com"),
        ("google", "google.com"),
        ("facebook", "facebook.com"),
        ("bank", ""),
    ];

    for (brand, expected_domain) in &brand_domains {
        if display_lower.contains(brand)
            && !expected_domain.is_empty()
            && !actual_domain.contains(expected_domain)
        {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_missing_date_detected() {
        let headers = vec![
            ("From".to_string(), "user@example.com".to_string()),
            ("Message-ID".to_string(), "<abc@example.com>".to_string()),
        ];
        let tests = analyze_headers(&headers, "user@example.com");
        assert!(tests.iter().any(|t| t.name == "MISSING_DATE"));
        assert!(!tests.iter().any(|t| t.name == "MISSING_MESSAGE_ID"));
    }

    #[test]
    fn test_missing_message_id_detected() {
        let headers = vec![
            ("From".to_string(), "user@example.com".to_string()),
            (
                "Date".to_string(),
                "Thu, 1 Jan 2026 00:00:00 +0000".to_string(),
            ),
        ];
        let tests = analyze_headers(&headers, "user@example.com");
        assert!(!tests.iter().any(|t| t.name == "MISSING_DATE"));
        assert!(tests.iter().any(|t| t.name == "MISSING_MESSAGE_ID"));
    }

    #[test]
    fn test_all_headers_present_no_penalty() {
        let headers = vec![
            ("From".to_string(), "user@example.com".to_string()),
            (
                "Date".to_string(),
                "Thu, 1 Jan 2026 00:00:00 +0000".to_string(),
            ),
            ("Message-ID".to_string(), "<abc@example.com>".to_string()),
        ];
        let tests = analyze_headers(&headers, "user@example.com");
        assert!(tests.is_empty());
    }

    #[test]
    fn test_empty_headers_no_checks() {
        let tests = analyze_headers(&[], "user@example.com");
        assert!(tests.is_empty());
    }

    #[test]
    fn test_forged_from_brand_mismatch() {
        assert!(is_forged_from(
            "PayPal Security <phisher@evil.com>",
            "phisher@evil.com"
        ));
    }

    #[test]
    fn test_forged_from_email_in_display_name() {
        assert!(is_forged_from(
            "admin@trusted.com <attacker@evil.com>",
            "attacker@evil.com"
        ));
    }

    #[test]
    fn test_legitimate_from_not_forged() {
        assert!(!is_forged_from(
            "John Doe <john@example.com>",
            "john@example.com"
        ));
    }

    #[test]
    fn test_no_display_name_not_forged() {
        assert!(!is_forged_from("<john@example.com>", "john@example.com"));
    }

    #[test]
    fn test_bare_email_not_forged() {
        assert!(!is_forged_from("john@example.com", "john@example.com"));
    }
}
