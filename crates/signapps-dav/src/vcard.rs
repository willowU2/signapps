//! Simple vCard (RFC 6350) parser and builder.
//!
//! Handles vCard 3.0 and 4.0 contact records. Supports the most common
//! properties: FN, N, EMAIL, TEL, ORG, ADR, TITLE, NOTE, URL, PHOTO, UID,
//! REV, BDAY.

use crate::{DavError, DavResult};
use serde::{Deserialize, Serialize};

/// A parsed vCard contact.
///
/// # Examples
///
/// ```
/// use signapps_dav::vcard::VCard;
/// let card = VCard {
///     uid: "contact-001".to_string(),
///     fn_name: "John Doe".to_string(),
///     n_family: Some("Doe".to_string()),
///     n_given: Some("John".to_string()),
///     emails: vec![("work".to_string(), "john@example.com".to_string())],
///     phones: vec![("cell".to_string(), "+1234567890".to_string())],
///     org: Some("ACME Corp".to_string()),
///     title: None,
///     note: None,
///     url: None,
///     bday: None,
///     addresses: vec![],
///     rev: None,
///     version: "3.0".to_string(),
/// };
/// assert_eq!(card.fn_name, "John Doe");
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VCard {
    /// Unique identifier (UID property).
    pub uid: String,
    /// Formatted name (FN property).
    pub fn_name: String,
    /// Family name from N property.
    pub n_family: Option<String>,
    /// Given name from N property.
    pub n_given: Option<String>,
    /// Email addresses as (type, value) pairs.
    pub emails: Vec<(String, String)>,
    /// Phone numbers as (type, value) pairs.
    pub phones: Vec<(String, String)>,
    /// Organization name (ORG property).
    pub org: Option<String>,
    /// Job title (TITLE property).
    pub title: Option<String>,
    /// Free-form note (NOTE property).
    pub note: Option<String>,
    /// URL property.
    pub url: Option<String>,
    /// Birthday (BDAY property, in vCard format).
    pub bday: Option<String>,
    /// Postal addresses as (type, formatted) pairs.
    pub addresses: Vec<(String, String)>,
    /// Revision timestamp (REV property).
    pub rev: Option<String>,
    /// vCard version (3.0 or 4.0).
    pub version: String,
}

impl VCard {
    /// Parse a vCard from its text representation.
    ///
    /// # Errors
    ///
    /// Returns [`DavError::VCardParse`] if the input is not a valid vCard.
    ///
    /// # Panics
    ///
    /// None.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_dav::vcard::VCard;
    /// let data = "BEGIN:VCARD\r\nVERSION:3.0\r\nUID:c1\r\nFN:Jane Doe\r\nEMAIL;TYPE=work:jane@example.com\r\nTEL;TYPE=cell:+33612345678\r\nORG:ACME\r\nEND:VCARD";
    /// let card = VCard::parse(data).unwrap();
    /// assert_eq!(card.fn_name, "Jane Doe");
    /// assert_eq!(card.emails.len(), 1);
    /// ```
    pub fn parse(vcard_data: &str) -> DavResult<Self> {
        let mut uid = None;
        let mut fn_name = None;
        let mut n_family = None;
        let mut n_given = None;
        let mut emails = Vec::new();
        let mut phones = Vec::new();
        let mut org = None;
        let mut title = None;
        let mut note = None;
        let mut url = None;
        let mut bday = None;
        let mut addresses = Vec::new();
        let mut rev = None;
        let mut version = "3.0".to_string();
        let mut in_vcard = false;

        for line in unfold_vcard_lines(vcard_data) {
            let line = line.trim();

            if line.eq_ignore_ascii_case("BEGIN:VCARD") {
                in_vcard = true;
                continue;
            }
            if line.eq_ignore_ascii_case("END:VCARD") {
                break;
            }
            if !in_vcard {
                continue;
            }

            if let Some((key_with_params, value)) = parse_vcard_line(line) {
                let (base_key, params) = split_key_params(key_with_params);
                let type_param = extract_type_param(&params);

                match base_key.to_uppercase().as_str() {
                    "UID" => uid = Some(value.to_string()),
                    "FN" => fn_name = Some(value.to_string()),
                    "N" => {
                        let parts: Vec<&str> = value.split(';').collect();
                        if let Some(family) = parts.first() {
                            if !family.is_empty() {
                                n_family = Some(family.to_string());
                            }
                        }
                        if let Some(given) = parts.get(1) {
                            if !given.is_empty() {
                                n_given = Some(given.to_string());
                            }
                        }
                    }
                    "EMAIL" => {
                        let t = type_param.unwrap_or_else(|| "other".to_string());
                        emails.push((t, value.to_string()));
                    }
                    "TEL" => {
                        let t = type_param.unwrap_or_else(|| "other".to_string());
                        phones.push((t, value.to_string()));
                    }
                    "ORG" => org = Some(value.replace(';', " ").trim().to_string()),
                    "TITLE" => title = Some(value.to_string()),
                    "NOTE" => note = Some(value.to_string()),
                    "URL" => url = Some(value.to_string()),
                    "BDAY" => bday = Some(value.to_string()),
                    "ADR" => {
                        let t = type_param.unwrap_or_else(|| "other".to_string());
                        // Format: PO Box;Extended;Street;City;Region;PostalCode;Country
                        let formatted = value
                            .split(';')
                            .filter(|s| !s.is_empty())
                            .collect::<Vec<_>>()
                            .join(", ");
                        if !formatted.is_empty() {
                            addresses.push((t, formatted));
                        }
                    }
                    "REV" => rev = Some(value.to_string()),
                    "VERSION" => version = value.to_string(),
                    _ => {} // Ignore unknown properties
                }
            }
        }

        let uid = uid.ok_or_else(|| DavError::VCardParse("Missing UID".to_string()))?;
        let fn_name = fn_name.ok_or_else(|| DavError::VCardParse("Missing FN".to_string()))?;

        Ok(Self {
            uid,
            fn_name,
            n_family,
            n_given,
            emails,
            phones,
            org,
            title,
            note,
            url,
            bday,
            addresses,
            rev,
            version,
        })
    }

    /// Serialize the vCard to its text representation.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_dav::vcard::VCard;
    /// let card = VCard {
    ///     uid: "c1".to_string(),
    ///     fn_name: "Alice".to_string(),
    ///     n_family: Some("Smith".to_string()),
    ///     n_given: Some("Alice".to_string()),
    ///     emails: vec![("work".to_string(), "alice@example.com".to_string())],
    ///     phones: vec![],
    ///     org: None,
    ///     title: None,
    ///     note: None,
    ///     url: None,
    ///     bday: None,
    ///     addresses: vec![],
    ///     rev: None,
    ///     version: "3.0".to_string(),
    /// };
    /// let text = card.to_vcard();
    /// assert!(text.contains("BEGIN:VCARD"));
    /// assert!(text.contains("FN:Alice"));
    /// assert!(text.contains("EMAIL;TYPE=work:alice@example.com"));
    /// ```
    ///
    /// # Panics
    ///
    /// None.
    pub fn to_vcard(&self) -> String {
        let mut lines = Vec::new();
        lines.push("BEGIN:VCARD".to_string());
        lines.push(format!("VERSION:{}", self.version));
        lines.push(format!("UID:{}", self.uid));
        lines.push(format!("FN:{}", self.fn_name));

        // N property
        let family = self.n_family.as_deref().unwrap_or("");
        let given = self.n_given.as_deref().unwrap_or("");
        lines.push(format!("N:{};{};;;", family, given));

        for (typ, email) in &self.emails {
            lines.push(format!("EMAIL;TYPE={}:{}", typ, email));
        }
        for (typ, phone) in &self.phones {
            lines.push(format!("TEL;TYPE={}:{}", typ, phone));
        }
        if let Some(ref org) = self.org {
            lines.push(format!("ORG:{}", org));
        }
        if let Some(ref title) = self.title {
            lines.push(format!("TITLE:{}", title));
        }
        if let Some(ref note) = self.note {
            lines.push(format!("NOTE:{}", note));
        }
        if let Some(ref url) = self.url {
            lines.push(format!("URL:{}", url));
        }
        if let Some(ref bday) = self.bday {
            lines.push(format!("BDAY:{}", bday));
        }
        for (typ, addr) in &self.addresses {
            lines.push(format!("ADR;TYPE={}:{}", typ, addr));
        }
        if let Some(ref rev) = self.rev {
            lines.push(format!("REV:{}", rev));
        }
        lines.push("END:VCARD".to_string());

        lines.join("\r\n")
    }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/// Unfold vCard lines (continuation lines start with a space or tab).
fn unfold_vcard_lines(data: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();

    for line in data.lines() {
        if line.starts_with(' ') || line.starts_with('\t') {
            current.push_str(line[1..].trim_end());
        } else {
            if !current.is_empty() {
                result.push(current);
            }
            current = line.trim_end().to_string();
        }
    }
    if !current.is_empty() {
        result.push(current);
    }
    result
}

/// Parse a vCard content line into (key-with-params, value).
fn parse_vcard_line(line: &str) -> Option<(&str, &str)> {
    let colon_pos = line.find(':')?;
    Some((&line[..colon_pos], &line[colon_pos + 1..]))
}

/// Split key from parameters (e.g. `EMAIL;TYPE=work` -> `("EMAIL", "TYPE=work")`).
fn split_key_params(key_with_params: &str) -> (&str, Vec<&str>) {
    let mut parts = key_with_params.split(';');
    let base_key = parts.next().unwrap_or(key_with_params);
    let params: Vec<&str> = parts.collect();
    (base_key, params)
}

/// Extract TYPE parameter value from params list.
fn extract_type_param(params: &[&str]) -> Option<String> {
    for param in params {
        let param_upper = param.to_uppercase();
        if param_upper.starts_with("TYPE=") {
            return Some(param[5..].to_lowercase());
        }
        // Some vCards use bare type values like ";WORK" instead of ";TYPE=WORK"
        if matches!(
            param_upper.as_str(),
            "WORK" | "HOME" | "CELL" | "FAX" | "PREF" | "VOICE" | "OTHER"
        ) {
            return Some(param.to_lowercase());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_vcard() {
        let data = "BEGIN:VCARD\r\nVERSION:3.0\r\nUID:contact-001\r\nFN:John Doe\r\nN:Doe;John;;;\r\nEMAIL;TYPE=work:john@example.com\r\nEMAIL;TYPE=home:john.doe@home.com\r\nTEL;TYPE=cell:+33612345678\r\nTEL;TYPE=work:+33198765432\r\nORG:ACME Corp\r\nTITLE:Developer\r\nNOTE:A note\r\nURL:https://example.com\r\nBDAY:1990-01-15\r\nEND:VCARD";

        let card = VCard::parse(data).unwrap();
        assert_eq!(card.uid, "contact-001");
        assert_eq!(card.fn_name, "John Doe");
        assert_eq!(card.n_family.as_deref(), Some("Doe"));
        assert_eq!(card.n_given.as_deref(), Some("John"));
        assert_eq!(card.emails.len(), 2);
        assert_eq!(card.emails[0], ("work".to_string(), "john@example.com".to_string()));
        assert_eq!(card.phones.len(), 2);
        assert_eq!(card.org.as_deref(), Some("ACME Corp"));
        assert_eq!(card.title.as_deref(), Some("Developer"));
        assert_eq!(card.note.as_deref(), Some("A note"));
        assert_eq!(card.url.as_deref(), Some("https://example.com"));
        assert_eq!(card.bday.as_deref(), Some("1990-01-15"));
    }

    #[test]
    fn test_build_vcard() {
        let card = VCard {
            uid: "build-001".to_string(),
            fn_name: "Alice Smith".to_string(),
            n_family: Some("Smith".to_string()),
            n_given: Some("Alice".to_string()),
            emails: vec![("work".to_string(), "alice@example.com".to_string())],
            phones: vec![("cell".to_string(), "+1234567890".to_string())],
            org: Some("TechCo".to_string()),
            title: Some("Engineer".to_string()),
            note: None,
            url: None,
            bday: None,
            addresses: vec![],
            rev: None,
            version: "3.0".to_string(),
        };

        let text = card.to_vcard();
        assert!(text.contains("BEGIN:VCARD"));
        assert!(text.contains("VERSION:3.0"));
        assert!(text.contains("UID:build-001"));
        assert!(text.contains("FN:Alice Smith"));
        assert!(text.contains("N:Smith;Alice;;;"));
        assert!(text.contains("EMAIL;TYPE=work:alice@example.com"));
        assert!(text.contains("TEL;TYPE=cell:+1234567890"));
        assert!(text.contains("ORG:TechCo"));
        assert!(text.contains("TITLE:Engineer"));
        assert!(text.contains("END:VCARD"));
    }

    #[test]
    fn test_vcard_roundtrip() {
        let original = VCard {
            uid: "rt-001".to_string(),
            fn_name: "Bob Jones".to_string(),
            n_family: Some("Jones".to_string()),
            n_given: Some("Bob".to_string()),
            emails: vec![("home".to_string(), "bob@home.com".to_string())],
            phones: vec![],
            org: None,
            title: None,
            note: None,
            url: None,
            bday: None,
            addresses: vec![],
            rev: None,
            version: "3.0".to_string(),
        };

        let text = original.to_vcard();
        let parsed = VCard::parse(&text).unwrap();
        assert_eq!(parsed.uid, original.uid);
        assert_eq!(parsed.fn_name, original.fn_name);
        assert_eq!(parsed.emails, original.emails);
    }

    #[test]
    fn test_vcard_missing_uid() {
        let data = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:No UID\r\nEND:VCARD";
        assert!(VCard::parse(data).is_err());
    }

    #[test]
    fn test_vcard_missing_fn() {
        let data = "BEGIN:VCARD\r\nVERSION:3.0\r\nUID:x\r\nEND:VCARD";
        assert!(VCard::parse(data).is_err());
    }
}
