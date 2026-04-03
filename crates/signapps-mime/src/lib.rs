#![warn(missing_docs)]

//! # SignApps MIME
//!
//! Pure-library crate for parsing, building, and inspecting MIME email messages.
//! No I/O, no network — only in-memory transformations on `&[u8]` and `String`.
//!
//! ## Modules
//!
//! - [`headers`] — RFC 5322 header parser with continuation-line unfolding
//! - [`encoding`] — Base64, quoted-printable, and RFC 2047 encoded-word codec
//! - [`parser`] — Recursive MIME multipart parser
//! - [`body_structure`] — IMAP BODYSTRUCTURE JSON builder
//! - [`builder`] — Fluent API to construct RFC 5322 messages
//!
//! ## Quick Start
//!
//! ```rust
//! use signapps_mime::{MimeMessage, MimeBuilder};
//!
//! // Parse an existing message
//! let raw = b"From: a@b.com\r\nSubject: Hi\r\n\r\nHello!";
//! let msg = MimeMessage::parse(raw).unwrap();
//! assert_eq!(msg.subject(), Some("Hi"));
//! assert_eq!(msg.text_body(), Some("Hello!".to_string()));
//!
//! // Build a new message
//! let built = MimeBuilder::new()
//!     .from("a@b.com")
//!     .to("c@d.com")
//!     .subject("Test")
//!     .text("Body text")
//!     .build();
//! ```

pub mod body_structure;
pub mod builder;
pub mod encoding;
pub mod headers;
pub mod parser;

// Re-exports for convenience
pub use builder::MimeBuilder;
pub use headers::Headers;

use sha2::{Digest, Sha256};

/// Errors that can occur during MIME parsing or encoding.
///
/// # Examples
///
/// ```
/// let err = signapps_mime::MimeError::Base64("invalid input".into());
/// assert!(err.to_string().contains("base64"));
/// ```
#[derive(Debug, Clone)]
pub enum MimeError {
    /// Invalid base64 encoding.
    Base64(String),
    /// Invalid quoted-printable encoding.
    QuotedPrintable(String),
    /// Structural error in the MIME message (e.g., missing boundary).
    InvalidStructure(String),
}

impl std::fmt::Display for MimeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Base64(msg) => write!(f, "base64 decoding error: {}", msg),
            Self::QuotedPrintable(msg) => write!(f, "quoted-printable decoding error: {}", msg),
            Self::InvalidStructure(msg) => write!(f, "MIME structure error: {}", msg),
        }
    }
}

impl std::error::Error for MimeError {}

/// A parsed MIME email message.
///
/// Contains the top-level headers, the structured body tree, and the
/// original raw bytes for hashing.
///
/// # Examples
///
/// ```
/// let raw = b"From: a@b.com\r\nSubject: Test\r\n\r\nBody";
/// let msg = signapps_mime::MimeMessage::parse(raw).unwrap();
/// assert_eq!(msg.from(), Some("a@b.com"));
/// ```
#[derive(Debug, Clone)]
pub struct MimeMessage {
    /// Parsed top-level headers.
    pub headers: Headers,
    /// Structured body (text, binary, or multipart tree).
    pub body: MimeBody,
    /// Original raw bytes (kept for content hashing).
    raw: Vec<u8>,
}

/// The body of a MIME message or part.
///
/// Can be plain text, binary data, or a recursive multipart container.
#[derive(Debug, Clone)]
pub enum MimeBody {
    /// Decoded text content (text/plain, text/html, etc.).
    Text(String),
    /// Raw binary content (images, PDFs, etc.).
    Binary(Vec<u8>),
    /// A multipart container with nested parts.
    Multipart {
        /// The multipart subtype (e.g., `mixed`, `alternative`, `related`).
        subtype: String,
        /// The boundary string used to delimit parts.
        boundary: String,
        /// The child parts.
        parts: Vec<MimePart>,
    },
}

/// A single part within a multipart MIME message.
#[derive(Debug, Clone)]
pub struct MimePart {
    /// Headers for this part.
    pub headers: Headers,
    /// Body of this part (may itself be multipart).
    pub body: MimeBody,
}

/// A decoded attachment extracted from a MIME message.
///
/// Contains the file metadata and decoded binary content.
#[derive(Debug, Clone)]
pub struct Attachment {
    /// Original filename from Content-Disposition, if present.
    pub filename: Option<String>,
    /// MIME content type (e.g., `image/png`).
    pub content_type: String,
    /// Size of the decoded data in bytes.
    pub size: usize,
    /// Decoded binary content.
    pub data: Vec<u8>,
    /// Content-ID for inline attachments (e.g., `<cid:image1>`).
    pub content_id: Option<String>,
    /// Disposition: `"attachment"` or `"inline"`.
    pub disposition: String,
}

impl MimeMessage {
    /// Parse a raw RFC 5322 email message from bytes.
    ///
    /// # Errors
    ///
    /// Returns [`MimeError::InvalidStructure`] if the message cannot be parsed.
    ///
    /// # Examples
    ///
    /// ```
    /// let msg = signapps_mime::MimeMessage::parse(b"Subject: Hi\r\n\r\nBody").unwrap();
    /// assert_eq!(msg.subject(), Some("Hi"));
    /// ```
    pub fn parse(raw: &[u8]) -> Result<Self, MimeError> {
        parser::parse_message(raw)
    }

    /// Return the decoded Subject header, or `None` if absent.
    ///
    /// # Panics
    ///
    /// None.
    pub fn subject(&self) -> Option<&str> {
        self.headers.get("Subject")
    }

    /// Return the From header value, or `None` if absent.
    ///
    /// # Panics
    ///
    /// None.
    pub fn from(&self) -> Option<&str> {
        self.headers.get("From")
    }

    /// Return all To recipients as a list.
    ///
    /// Splits the To header on commas. Returns an empty vec if no To header.
    ///
    /// # Panics
    ///
    /// None.
    pub fn to(&self) -> Vec<&str> {
        self.headers
            .get("To")
            .map(|v| v.split(',').map(|s| s.trim()).collect())
            .unwrap_or_default()
    }

    /// Return the Date header value, or `None` if absent.
    ///
    /// # Panics
    ///
    /// None.
    pub fn date(&self) -> Option<&str> {
        self.headers.get("Date")
    }

    /// Return the Message-ID header value, or `None` if absent.
    ///
    /// # Panics
    ///
    /// None.
    pub fn message_id(&self) -> Option<&str> {
        self.headers.get("Message-ID")
    }

    /// Return the In-Reply-To header value, or `None` if absent.
    ///
    /// # Panics
    ///
    /// None.
    pub fn in_reply_to(&self) -> Option<&str> {
        self.headers.get("In-Reply-To")
    }

    /// Return all message IDs from the References header.
    ///
    /// # Panics
    ///
    /// None.
    pub fn references(&self) -> Vec<&str> {
        self.headers
            .get("References")
            .map(|v| v.split_whitespace().collect())
            .unwrap_or_default()
    }

    /// Return the List-Unsubscribe header value, or `None` if absent.
    ///
    /// # Panics
    ///
    /// None.
    pub fn list_unsubscribe(&self) -> Option<&str> {
        self.headers.get("List-Unsubscribe")
    }

    /// Return the List-Id header value, or `None` if absent.
    ///
    /// # Panics
    ///
    /// None.
    pub fn list_id(&self) -> Option<&str> {
        self.headers.get("List-Id")
    }

    /// Extract the decoded text/plain body, if present.
    ///
    /// For multipart messages, searches recursively for the first `text/plain` part.
    ///
    /// # Panics
    ///
    /// None.
    pub fn text_body(&self) -> Option<String> {
        find_text_body(&self.headers, &self.body, "text/plain")
    }

    /// Extract the decoded text/html body, if present.
    ///
    /// For multipart messages, searches recursively for the first `text/html` part.
    ///
    /// # Panics
    ///
    /// None.
    pub fn html_body(&self) -> Option<String> {
        find_text_body(&self.headers, &self.body, "text/html")
    }

    /// Extract all attachments from the message.
    ///
    /// Walks the MIME tree and collects parts with `Content-Disposition: attachment`
    /// or non-text content types without an inline disposition.
    ///
    /// # Panics
    ///
    /// None.
    pub fn attachments(&self) -> Vec<Attachment> {
        let mut result = Vec::new();
        collect_attachments(&self.body, &self.headers, &mut result);
        result
    }

    /// Build an IMAP-style BODYSTRUCTURE as a JSON value.
    ///
    /// # Panics
    ///
    /// None.
    pub fn body_structure(&self) -> serde_json::Value {
        body_structure::build_body_structure(self)
    }

    /// Get an arbitrary header by name (case-insensitive).
    ///
    /// # Panics
    ///
    /// None.
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers.get(name)
    }

    /// Compute the SHA-256 hash of the raw message bytes.
    ///
    /// Returns a lowercase hex string.
    ///
    /// # Panics
    ///
    /// None.
    pub fn content_hash(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(&self.raw);
        let result = hasher.finalize();
        result.iter().map(|b| format!("{:02x}", b)).collect()
    }
}

/// Recursively find a text body of the specified MIME type.
fn find_text_body(headers: &Headers, body: &MimeBody, target_type: &str) -> Option<String> {
    match body {
        MimeBody::Text(text) => {
            let ct = headers
                .get("Content-Type")
                .unwrap_or("text/plain")
                .to_ascii_lowercase();
            if ct.starts_with(target_type) {
                Some(text.clone())
            } else {
                None
            }
        },
        MimeBody::Multipart { parts, .. } => {
            for part in parts {
                if let Some(found) = find_text_body(&part.headers, &part.body, target_type) {
                    return Some(found);
                }
            }
            None
        },
        MimeBody::Binary(_) => None,
    }
}

/// Recursively collect attachments from the MIME tree.
fn collect_attachments(body: &MimeBody, headers: &Headers, result: &mut Vec<Attachment>) {
    match body {
        MimeBody::Multipart { parts, .. } => {
            for part in parts {
                collect_attachments(&part.body, &part.headers, result);
            }
        },
        MimeBody::Binary(data) => {
            let disposition = headers.get("Content-Disposition").unwrap_or("attachment");

            let ct = headers
                .get("Content-Type")
                .unwrap_or("application/octet-stream");

            let filename = extract_filename(headers);
            let content_id = headers.get("Content-ID").map(|s| s.to_string());

            let disp_type = if disposition.to_ascii_lowercase().starts_with("inline") {
                "inline".to_string()
            } else {
                "attachment".to_string()
            };

            result.push(Attachment {
                filename,
                content_type: ct.split(';').next().unwrap_or(ct).trim().to_string(),
                size: data.len(),
                data: data.clone(),
                content_id,
                disposition: disp_type,
            });
        },
        MimeBody::Text(_) => {
            // Only collect text parts that have an attachment disposition
            let disposition = headers.get("Content-Disposition").unwrap_or("");
            if disposition.to_ascii_lowercase().starts_with("attachment") {
                let ct = headers.get("Content-Type").unwrap_or("text/plain");
                let filename = extract_filename(headers);
                let content_id = headers.get("Content-ID").map(|s| s.to_string());

                if let MimeBody::Text(text) = body {
                    result.push(Attachment {
                        filename,
                        content_type: ct.split(';').next().unwrap_or(ct).trim().to_string(),
                        size: text.len(),
                        data: text.as_bytes().to_vec(),
                        content_id,
                        disposition: "attachment".to_string(),
                    });
                }
            }
        },
    }
}

/// Extract filename from Content-Disposition or Content-Type `name` parameter.
fn extract_filename(headers: &Headers) -> Option<String> {
    // Try Content-Disposition filename first
    if let Some(disp) = headers.get("Content-Disposition") {
        if let Some(fname) = extract_param(disp, "filename") {
            return Some(fname);
        }
    }
    // Fallback to Content-Type name parameter
    if let Some(ct) = headers.get("Content-Type") {
        if let Some(name) = extract_param(ct, "name") {
            return Some(name);
        }
    }
    None
}

/// Extract a named parameter from a header value string.
fn extract_param(header_value: &str, param_name: &str) -> Option<String> {
    let search = format!("{}=", param_name);
    let lower = header_value.to_ascii_lowercase();
    if let Some(pos) = lower.find(&search) {
        let after = &header_value[pos + search.len()..];
        let value = if let Some(stripped) = after.strip_prefix('"') {
            // Quoted value
            stripped.split('"').next().unwrap_or("").to_string()
        } else {
            // Unquoted — take until semicolon or end
            after.split(';').next().unwrap_or("").trim().to_string()
        };
        if value.is_empty() {
            None
        } else {
            Some(value)
        }
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_text_email() {
        let raw = b"From: alice@example.com\r\n\
                     To: bob@example.com\r\n\
                     Subject: Hello\r\n\
                     Content-Type: text/plain\r\n\
                     \r\n\
                     Hello, Bob!\r\n";

        let msg = MimeMessage::parse(raw).unwrap();
        assert_eq!(msg.from(), Some("alice@example.com"));
        assert_eq!(msg.subject(), Some("Hello"));
        assert_eq!(msg.to(), vec!["bob@example.com"]);
        assert_eq!(msg.text_body(), Some("Hello, Bob!\r\n".to_string()));
    }

    #[test]
    fn test_parse_multipart_alternative() {
        let raw = b"From: alice@example.com\r\n\
                     Content-Type: multipart/alternative; boundary=\"bound1\"\r\n\
                     \r\n\
                     --bound1\r\n\
                     Content-Type: text/plain\r\n\
                     \r\n\
                     Plain text\r\n\
                     --bound1\r\n\
                     Content-Type: text/html\r\n\
                     \r\n\
                     <b>HTML</b>\r\n\
                     --bound1--\r\n";

        let msg = MimeMessage::parse(raw).unwrap();
        assert_eq!(msg.text_body(), Some("Plain text".to_string()));
        assert_eq!(msg.html_body(), Some("<b>HTML</b>".to_string()));
    }

    #[test]
    fn test_parse_multipart_mixed_with_attachment() {
        let raw = b"Content-Type: multipart/mixed; boundary=\"outer\"\r\n\
                     \r\n\
                     --outer\r\n\
                     Content-Type: text/plain\r\n\
                     \r\n\
                     Hello\r\n\
                     --outer\r\n\
                     Content-Type: application/pdf; name=\"doc.pdf\"\r\n\
                     Content-Disposition: attachment; filename=\"doc.pdf\"\r\n\
                     Content-Transfer-Encoding: base64\r\n\
                     \r\n\
                     AQIDBA==\r\n\
                     --outer--\r\n";

        let msg = MimeMessage::parse(raw).unwrap();
        let attachments = msg.attachments();
        assert_eq!(attachments.len(), 1);
        assert_eq!(attachments[0].filename, Some("doc.pdf".into()));
        assert_eq!(attachments[0].content_type, "application/pdf");
        assert_eq!(attachments[0].data, vec![1, 2, 3, 4]);
        assert_eq!(attachments[0].disposition, "attachment");
    }

    #[test]
    fn test_parse_nested_multipart() {
        let raw = b"Content-Type: multipart/mixed; boundary=\"outer\"\r\n\
                     \r\n\
                     --outer\r\n\
                     Content-Type: multipart/alternative; boundary=\"inner\"\r\n\
                     \r\n\
                     --inner\r\n\
                     Content-Type: text/plain\r\n\
                     \r\n\
                     Plain\r\n\
                     --inner\r\n\
                     Content-Type: text/html\r\n\
                     \r\n\
                     <b>HTML</b>\r\n\
                     --inner--\r\n\
                     --outer\r\n\
                     Content-Type: image/png\r\n\
                     Content-Transfer-Encoding: base64\r\n\
                     Content-Disposition: attachment; filename=\"img.png\"\r\n\
                     \r\n\
                     AQID\r\n\
                     --outer--\r\n";

        let msg = MimeMessage::parse(raw).unwrap();
        assert_eq!(msg.text_body(), Some("Plain".to_string()));
        assert_eq!(msg.html_body(), Some("<b>HTML</b>".to_string()));

        let att = msg.attachments();
        assert_eq!(att.len(), 1);
        assert_eq!(att[0].filename, Some("img.png".into()));
    }

    #[test]
    fn test_decode_base64_body() {
        let raw = b"Content-Type: text/plain\r\n\
                     Content-Transfer-Encoding: base64\r\n\
                     \r\n\
                     SGVsbG8sIFdvcmxkIQ==\r\n";

        let msg = MimeMessage::parse(raw).unwrap();
        assert_eq!(msg.text_body(), Some("Hello, World!".to_string()));
    }

    #[test]
    fn test_decode_quoted_printable_body() {
        let raw = b"Content-Type: text/plain; charset=utf-8\r\n\
                     Content-Transfer-Encoding: quoted-printable\r\n\
                     \r\n\
                     Hello=20World\r\n";

        let msg = MimeMessage::parse(raw).unwrap();
        let text = msg.text_body().unwrap();
        assert!(text.contains("Hello World"));
    }

    #[test]
    fn test_decode_rfc2047_subject() {
        let raw = b"Subject: =?UTF-8?B?SGVsbG8gV29ybGQ=?=\r\n\
                     Content-Type: text/plain\r\n\
                     \r\n\
                     body\r\n";

        let msg = MimeMessage::parse(raw).unwrap();
        let decoded = msg.headers.get_decoded("Subject").unwrap();
        assert_eq!(decoded, "Hello World");
    }

    #[test]
    fn test_build_simple_text_email() {
        let msg = MimeBuilder::new()
            .from("alice@example.com")
            .to("bob@example.com")
            .subject("Hello")
            .text("Hello, Bob!")
            .build();

        let output = String::from_utf8_lossy(&msg);
        assert!(output.contains("From: alice@example.com"));
        assert!(output.contains("To: bob@example.com"));
        assert!(output.contains("Subject: Hello"));
        assert!(output.contains("Hello, Bob!"));

        // Verify it round-trips through the parser
        let parsed = MimeMessage::parse(&msg).unwrap();
        assert_eq!(parsed.from(), Some("alice@example.com"));
        assert_eq!(parsed.subject(), Some("Hello"));
    }

    #[test]
    fn test_build_multipart_with_attachment() {
        let msg = MimeBuilder::new()
            .from("alice@example.com")
            .to("bob@example.com")
            .subject("Attached")
            .text("See attached.")
            .attach("test.bin", vec![1, 2, 3, 4], "application/octet-stream")
            .build();

        let parsed = MimeMessage::parse(&msg).unwrap();
        assert_eq!(parsed.from(), Some("alice@example.com"));
        assert_eq!(parsed.text_body(), Some("See attached.".to_string()));

        let att = parsed.attachments();
        assert_eq!(att.len(), 1);
        assert_eq!(att[0].filename, Some("test.bin".to_string()));
        assert_eq!(att[0].data, vec![1, 2, 3, 4]);
    }

    #[test]
    fn test_body_structure_produces_valid_json() {
        let raw = b"Content-Type: multipart/mixed; boundary=\"b1\"\r\n\
                     \r\n\
                     --b1\r\n\
                     Content-Type: text/plain; charset=utf-8\r\n\
                     \r\n\
                     Hello\r\n\
                     --b1\r\n\
                     Content-Type: image/png\r\n\
                     Content-Transfer-Encoding: base64\r\n\
                     \r\n\
                     AQID\r\n\
                     --b1--\r\n";

        let msg = MimeMessage::parse(raw).unwrap();
        let bs = msg.body_structure();

        // Verify it's valid JSON by serializing
        let json_str = serde_json::to_string_pretty(&bs).unwrap();
        assert!(!json_str.is_empty());

        // Verify structure
        assert_eq!(bs["type"], "multipart");
        assert_eq!(bs["subtype"], "mixed");

        let parts = bs["parts"].as_array().unwrap();
        assert_eq!(parts.len(), 2);
        assert_eq!(parts[0]["type"], "text");
        assert_eq!(parts[0]["subtype"], "plain");
        assert_eq!(parts[1]["type"], "image");
        assert_eq!(parts[1]["subtype"], "png");
    }

    #[test]
    fn test_content_hash() {
        let raw = b"Subject: Test\r\n\r\nBody";
        let msg = MimeMessage::parse(raw).unwrap();
        let hash = msg.content_hash();
        // SHA-256 is 64 hex chars
        assert_eq!(hash.len(), 64);
        // Same input should produce same hash
        let msg2 = MimeMessage::parse(raw).unwrap();
        assert_eq!(msg.content_hash(), msg2.content_hash());
    }

    #[test]
    fn test_message_id_and_references() {
        let raw = b"Message-ID: <abc@example.com>\r\n\
                     In-Reply-To: <parent@example.com>\r\n\
                     References: <root@example.com> <parent@example.com>\r\n\
                     \r\n\
                     body\r\n";

        let msg = MimeMessage::parse(raw).unwrap();
        assert_eq!(msg.message_id(), Some("<abc@example.com>"));
        assert_eq!(msg.in_reply_to(), Some("<parent@example.com>"));
        assert_eq!(
            msg.references(),
            vec!["<root@example.com>", "<parent@example.com>"]
        );
    }

    #[test]
    fn test_list_headers() {
        let raw = b"List-Unsubscribe: <mailto:unsub@example.com>\r\n\
                     List-Id: <list.example.com>\r\n\
                     \r\n\
                     body\r\n";

        let msg = MimeMessage::parse(raw).unwrap();
        assert_eq!(msg.list_unsubscribe(), Some("<mailto:unsub@example.com>"));
        assert_eq!(msg.list_id(), Some("<list.example.com>"));
    }
}
