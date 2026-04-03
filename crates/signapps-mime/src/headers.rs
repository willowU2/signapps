//! RFC 5322 header parsing and structured header extraction.
//!
//! Handles header unfolding, RFC 2047 decoding, and Content-Type parameter parsing.

use crate::encoding::decode_rfc2047;

/// A collection of MIME headers as name-value pairs.
///
/// Headers are stored in their original order. Names are case-insensitive
/// for lookup but preserved as-is for serialization.
///
/// # Examples
///
/// ```
/// let headers = signapps_mime::Headers::parse("Subject: Hello\r\nFrom: a@b.com\r\n");
/// assert_eq!(headers.get("subject"), Some("Hello"));
/// ```
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct Headers(pub Vec<(String, String)>);

impl Headers {
    /// Parse raw RFC 5322 headers from a string.
    ///
    /// Handles continuation lines (lines starting with whitespace are unfolded
    /// and appended to the previous header). Stops at the first empty line or
    /// end of input.
    ///
    /// # Panics
    ///
    /// None.
    pub fn parse(raw: &str) -> Self {
        let mut headers = Vec::new();

        for line in raw.lines() {
            if line.is_empty() {
                break;
            }

            if line.starts_with(' ') || line.starts_with('\t') {
                // Continuation line — unfold by appending to the last header
                if let Some(last) = headers.last_mut() {
                    let (_, ref mut value): &mut (String, String) = last;
                    value.push(' ');
                    value.push_str(line.trim());
                }
            } else if let Some(colon_pos) = line.find(':') {
                let name = line[..colon_pos].trim().to_string();
                let value = line[colon_pos + 1..].trim().to_string();
                headers.push((name, value));
            }
        }

        Self(headers)
    }

    /// Get the first header value matching the given name (case-insensitive).
    ///
    /// # Panics
    ///
    /// None.
    pub fn get(&self, name: &str) -> Option<&str> {
        let name_lower = name.to_ascii_lowercase();
        self.0
            .iter()
            .find(|(n, _)| n.to_ascii_lowercase() == name_lower)
            .map(|(_, v)| v.as_str())
    }

    /// Get all header values matching the given name (case-insensitive).
    ///
    /// # Panics
    ///
    /// None.
    pub fn get_all(&self, name: &str) -> Vec<&str> {
        let name_lower = name.to_ascii_lowercase();
        self.0
            .iter()
            .filter(|(n, _)| n.to_ascii_lowercase() == name_lower)
            .map(|(_, v)| v.as_str())
            .collect()
    }

    /// Get a header value with RFC 2047 encoded words decoded.
    ///
    /// # Panics
    ///
    /// None.
    pub fn get_decoded(&self, name: &str) -> Option<String> {
        self.get(name).map(decode_rfc2047)
    }

    /// Set a header value (replaces first occurrence, or appends if not present).
    ///
    /// # Panics
    ///
    /// None.
    pub fn set(&mut self, name: &str, value: &str) {
        let name_lower = name.to_ascii_lowercase();
        if let Some(entry) = self
            .0
            .iter_mut()
            .find(|(n, _)| n.to_ascii_lowercase() == name_lower)
        {
            entry.1 = value.to_string();
        } else {
            self.0.push((name.to_string(), value.to_string()));
        }
    }

    /// Append a new header (even if one with this name already exists).
    ///
    /// # Panics
    ///
    /// None.
    pub fn append(&mut self, name: &str, value: &str) {
        self.0.push((name.to_string(), value.to_string()));
    }

    /// Check whether a header with the given name exists.
    ///
    /// # Panics
    ///
    /// None.
    pub fn contains(&self, name: &str) -> bool {
        self.get(name).is_some()
    }

    /// Return the number of headers.
    ///
    /// # Panics
    ///
    /// None.
    pub fn len(&self) -> usize {
        self.0.len()
    }

    /// Return true if there are no headers.
    ///
    /// # Panics
    ///
    /// None.
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    /// Iterate over all headers as `(name, value)` pairs.
    ///
    /// # Panics
    ///
    /// None.
    pub fn iter(&self) -> impl Iterator<Item = (&str, &str)> {
        self.0.iter().map(|(n, v)| (n.as_str(), v.as_str()))
    }
}

/// Parsed Content-Type header with MIME type and parameters.
///
/// # Examples
///
/// ```
/// let ct = signapps_mime::headers::ContentType::parse(
///     "multipart/mixed; boundary=\"abc123\""
/// );
/// assert_eq!(ct.mime_type, "multipart/mixed");
/// assert_eq!(ct.param("boundary"), Some("abc123"));
/// ```
#[derive(Debug, Clone)]
pub struct ContentType {
    /// The MIME type (e.g., `text/plain`, `multipart/mixed`).
    pub mime_type: String,
    /// Parameters as key-value pairs (e.g., `charset=utf-8`).
    pub params: Vec<(String, String)>,
}

impl ContentType {
    /// Parse a Content-Type header value.
    ///
    /// # Panics
    ///
    /// None.
    pub fn parse(value: &str) -> Self {
        let mut parts = value.splitn(2, ';');
        let mime_type = parts
            .next()
            .unwrap_or("text/plain")
            .trim()
            .to_ascii_lowercase();

        let mut params = Vec::new();
        if let Some(rest) = parts.next() {
            for param in split_params(rest) {
                if let Some(eq_pos) = param.find('=') {
                    let key = param[..eq_pos].trim().to_ascii_lowercase();
                    let val = param[eq_pos + 1..].trim();
                    // Strip quotes
                    let val = if val.starts_with('"') && val.ends_with('"') && val.len() >= 2 {
                        &val[1..val.len() - 1]
                    } else {
                        val
                    };
                    params.push((key, val.to_string()));
                }
            }
        }

        Self { mime_type, params }
    }

    /// Get a parameter value by name (case-insensitive).
    ///
    /// # Panics
    ///
    /// None.
    pub fn param(&self, name: &str) -> Option<&str> {
        let name_lower = name.to_ascii_lowercase();
        self.params
            .iter()
            .find(|(k, _)| *k == name_lower)
            .map(|(_, v)| v.as_str())
    }

    /// Return true if this is a multipart type.
    ///
    /// # Panics
    ///
    /// None.
    pub fn is_multipart(&self) -> bool {
        self.mime_type.starts_with("multipart/")
    }

    /// Return the multipart subtype (e.g., `mixed`, `alternative`).
    ///
    /// Returns `None` if this is not a multipart type.
    ///
    /// # Panics
    ///
    /// None.
    pub fn multipart_subtype(&self) -> Option<&str> {
        if self.is_multipart() {
            self.mime_type.strip_prefix("multipart/")
        } else {
            None
        }
    }
}

/// Split parameter string by semicolons, respecting quoted strings.
fn split_params(input: &str) -> Vec<String> {
    let mut params = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;

    for ch in input.chars() {
        match ch {
            '"' => {
                in_quotes = !in_quotes;
                current.push(ch);
            },
            ';' if !in_quotes => {
                let trimmed = current.trim().to_string();
                if !trimmed.is_empty() {
                    params.push(trimmed);
                }
                current.clear();
            },
            _ => current.push(ch),
        }
    }

    let trimmed = current.trim().to_string();
    if !trimmed.is_empty() {
        params.push(trimmed);
    }

    params
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_headers() {
        let raw = "From: alice@example.com\r\nTo: bob@example.com\r\nSubject: Test\r\n";
        let headers = Headers::parse(raw);
        assert_eq!(headers.get("From"), Some("alice@example.com"));
        assert_eq!(headers.get("to"), Some("bob@example.com"));
        assert_eq!(headers.get("Subject"), Some("Test"));
    }

    #[test]
    fn test_header_continuation() {
        let raw = "Subject: This is a\r\n very long subject\r\nFrom: a@b.com\r\n";
        let headers = Headers::parse(raw);
        assert_eq!(headers.get("Subject"), Some("This is a very long subject"));
    }

    #[test]
    fn test_content_type_with_params() {
        let ct = ContentType::parse("multipart/mixed; boundary=\"----=_Part_123\"");
        assert_eq!(ct.mime_type, "multipart/mixed");
        assert_eq!(ct.param("boundary"), Some("----=_Part_123"));
        assert!(ct.is_multipart());
        assert_eq!(ct.multipart_subtype(), Some("mixed"));
    }

    #[test]
    fn test_content_type_text_plain() {
        let ct = ContentType::parse("text/plain; charset=utf-8");
        assert_eq!(ct.mime_type, "text/plain");
        assert_eq!(ct.param("charset"), Some("utf-8"));
        assert!(!ct.is_multipart());
    }

    #[test]
    fn test_header_case_insensitive() {
        let raw = "Content-Type: text/html\r\n";
        let headers = Headers::parse(raw);
        assert_eq!(headers.get("content-type"), Some("text/html"));
        assert_eq!(headers.get("CONTENT-TYPE"), Some("text/html"));
    }

    #[test]
    fn test_headers_get_all() {
        let raw = "Received: from a\r\nReceived: from b\r\n";
        let headers = Headers::parse(raw);
        let received = headers.get_all("Received");
        assert_eq!(received.len(), 2);
    }
}
