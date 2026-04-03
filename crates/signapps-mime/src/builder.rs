//! Fluent API for constructing RFC 5322 MIME messages.
//!
//! The [`MimeBuilder`] produces well-formed email messages with support for
//! text bodies, HTML alternatives, attachments, and custom headers.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::encoding::encode_base64;

/// A fluent builder for constructing MIME email messages.
///
/// # Examples
///
/// ```
/// use signapps_mime::MimeBuilder;
///
/// let msg = MimeBuilder::new()
///     .from("alice@example.com")
///     .to("bob@example.com")
///     .subject("Hello")
///     .text("Hello, Bob!")
///     .build();
///
/// let output = String::from_utf8_lossy(&msg);
/// assert!(output.contains("From: alice@example.com"));
/// assert!(output.contains("Subject: Hello"));
/// assert!(output.contains("Hello, Bob!"));
/// ```
///
/// # Panics
///
/// None.
#[derive(Debug, Clone)]
pub struct MimeBuilder {
    /// Custom and standard headers.
    headers: Vec<(String, String)>,
    /// Plain text body.
    text_body: Option<String>,
    /// HTML body.
    html_body: Option<String>,
    /// File attachments.
    attachments: Vec<BuilderAttachment>,
}

/// An attachment to include in the built message.
#[derive(Debug, Clone)]
struct BuilderAttachment {
    /// Filename for the Content-Disposition header.
    filename: String,
    /// Raw attachment data.
    data: Vec<u8>,
    /// MIME content type (e.g., `application/pdf`).
    content_type: String,
}

impl MimeBuilder {
    /// Create a new empty message builder.
    ///
    /// # Panics
    ///
    /// None.
    pub fn new() -> Self {
        Self {
            headers: Vec::new(),
            text_body: None,
            html_body: None,
            attachments: Vec::new(),
        }
    }

    /// Set the `From` header.
    ///
    /// # Panics
    ///
    /// None.
    pub fn from(mut self, addr: &str) -> Self {
        self.headers.push(("From".into(), addr.into()));
        self
    }

    /// Add a `To` recipient. Can be called multiple times.
    ///
    /// # Panics
    ///
    /// None.
    pub fn to(mut self, addr: &str) -> Self {
        // Check if To already exists, if so append
        if let Some(entry) = self.headers.iter_mut().find(|(n, _)| n == "To") {
            entry.1.push_str(", ");
            entry.1.push_str(addr);
        } else {
            self.headers.push(("To".into(), addr.into()));
        }
        self
    }

    /// Set the `Subject` header.
    ///
    /// # Panics
    ///
    /// None.
    pub fn subject(mut self, s: &str) -> Self {
        self.headers.push(("Subject".into(), s.into()));
        self
    }

    /// Set the `Message-ID` header.
    ///
    /// # Panics
    ///
    /// None.
    pub fn message_id(mut self, id: &str) -> Self {
        self.headers.push(("Message-ID".into(), id.into()));
        self
    }

    /// Set the `Date` header from a `DateTime<Utc>`.
    ///
    /// Formats according to RFC 5322 (e.g., `Thu, 01 Jan 2026 12:00:00 +0000`).
    ///
    /// # Panics
    ///
    /// None.
    pub fn date(mut self, dt: DateTime<Utc>) -> Self {
        let formatted = dt.format("%a, %d %b %Y %H:%M:%S %z").to_string();
        self.headers.push(("Date".into(), formatted));
        self
    }

    /// Set the plain-text body.
    ///
    /// # Panics
    ///
    /// None.
    pub fn text(mut self, body: &str) -> Self {
        self.text_body = Some(body.into());
        self
    }

    /// Set the HTML body.
    ///
    /// # Panics
    ///
    /// None.
    pub fn html(mut self, body: &str) -> Self {
        self.html_body = Some(body.into());
        self
    }

    /// Add a file attachment.
    ///
    /// # Panics
    ///
    /// None.
    pub fn attach(mut self, filename: &str, data: Vec<u8>, content_type: &str) -> Self {
        self.attachments.push(BuilderAttachment {
            filename: filename.into(),
            data,
            content_type: content_type.into(),
        });
        self
    }

    /// Add an arbitrary header.
    ///
    /// # Panics
    ///
    /// None.
    pub fn header(mut self, name: &str, value: &str) -> Self {
        self.headers.push((name.into(), value.into()));
        self
    }

    /// Build the complete RFC 5322 message as raw bytes.
    ///
    /// The structure depends on what was provided:
    /// - Text only: simple `text/plain` message
    /// - HTML only: simple `text/html` message
    /// - Text + HTML: `multipart/alternative`
    /// - With attachments: `multipart/mixed` wrapping the body
    ///
    /// # Panics
    ///
    /// None.
    pub fn build(self) -> Vec<u8> {
        let mut output = String::new();

        let has_text = self.text_body.is_some();
        let has_html = self.html_body.is_some();
        let has_attachments = !self.attachments.is_empty();
        let has_alternatives = has_text && has_html;

        // Determine structure and generate Message-ID if not set
        let has_message_id = self.headers.iter().any(|(n, _)| n == "Message-ID");

        // Write provided headers
        for (name, value) in &self.headers {
            output.push_str(&format!("{}: {}\r\n", name, value));
        }

        if !has_message_id {
            output.push_str(&format!(
                "Message-ID: <{}@signapps.local>\r\n",
                Uuid::new_v4()
            ));
        }

        output.push_str("MIME-Version: 1.0\r\n");

        if has_attachments {
            let outer_boundary = generate_boundary();
            output.push_str(&format!(
                "Content-Type: multipart/mixed; boundary=\"{}\"\r\n",
                outer_boundary
            ));
            output.push_str("\r\n");

            // Body part(s)
            output.push_str(&format!("--{}\r\n", outer_boundary));

            if has_alternatives {
                let alt_boundary = generate_boundary();
                output.push_str(&format!(
                    "Content-Type: multipart/alternative; boundary=\"{}\"\r\n",
                    alt_boundary
                ));
                output.push_str("\r\n");
                write_text_part(&mut output, &alt_boundary, self.text_body.as_deref());
                write_html_part(&mut output, &alt_boundary, self.html_body.as_deref());
                output.push_str(&format!("--{}--\r\n", alt_boundary));
            } else if has_text {
                output.push_str("Content-Type: text/plain; charset=utf-8\r\n");
                output.push_str("Content-Transfer-Encoding: 7bit\r\n");
                output.push_str("\r\n");
                output.push_str(self.text_body.as_deref().unwrap_or(""));
                output.push_str("\r\n");
            } else if has_html {
                output.push_str("Content-Type: text/html; charset=utf-8\r\n");
                output.push_str("Content-Transfer-Encoding: 7bit\r\n");
                output.push_str("\r\n");
                output.push_str(self.html_body.as_deref().unwrap_or(""));
                output.push_str("\r\n");
            }

            // Attachments
            for att in &self.attachments {
                output.push_str(&format!("--{}\r\n", outer_boundary));
                output.push_str(&format!(
                    "Content-Type: {}; name=\"{}\"\r\n",
                    att.content_type, att.filename
                ));
                output.push_str("Content-Transfer-Encoding: base64\r\n");
                output.push_str(&format!(
                    "Content-Disposition: attachment; filename=\"{}\"\r\n",
                    att.filename
                ));
                output.push_str("\r\n");
                output.push_str(&fold_base64(&encode_base64(&att.data)));
                output.push_str("\r\n");
            }

            output.push_str(&format!("--{}--\r\n", outer_boundary));
        } else if has_alternatives {
            let alt_boundary = generate_boundary();
            output.push_str(&format!(
                "Content-Type: multipart/alternative; boundary=\"{}\"\r\n",
                alt_boundary
            ));
            output.push_str("\r\n");
            write_text_part(&mut output, &alt_boundary, self.text_body.as_deref());
            write_html_part(&mut output, &alt_boundary, self.html_body.as_deref());
            output.push_str(&format!("--{}--\r\n", alt_boundary));
        } else if has_html {
            output.push_str("Content-Type: text/html; charset=utf-8\r\n");
            output.push_str("Content-Transfer-Encoding: 7bit\r\n");
            output.push_str("\r\n");
            output.push_str(self.html_body.as_deref().unwrap_or(""));
            output.push_str("\r\n");
        } else {
            // Default: text/plain
            output.push_str("Content-Type: text/plain; charset=utf-8\r\n");
            output.push_str("Content-Transfer-Encoding: 7bit\r\n");
            output.push_str("\r\n");
            output.push_str(self.text_body.as_deref().unwrap_or(""));
            output.push_str("\r\n");
        }

        output.into_bytes()
    }
}

impl Default for MimeBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Write a text/plain part inside a multipart boundary.
fn write_text_part(output: &mut String, boundary: &str, text: Option<&str>) {
    if let Some(text) = text {
        output.push_str(&format!("--{}\r\n", boundary));
        output.push_str("Content-Type: text/plain; charset=utf-8\r\n");
        output.push_str("Content-Transfer-Encoding: 7bit\r\n");
        output.push_str("\r\n");
        output.push_str(text);
        output.push_str("\r\n");
    }
}

/// Write a text/html part inside a multipart boundary.
fn write_html_part(output: &mut String, boundary: &str, html: Option<&str>) {
    if let Some(html) = html {
        output.push_str(&format!("--{}\r\n", boundary));
        output.push_str("Content-Type: text/html; charset=utf-8\r\n");
        output.push_str("Content-Transfer-Encoding: 7bit\r\n");
        output.push_str("\r\n");
        output.push_str(html);
        output.push_str("\r\n");
    }
}

/// Generate a unique MIME boundary string.
fn generate_boundary() -> String {
    format!("----=_Part_{}", Uuid::new_v4().as_simple())
}

/// Fold a base64 string into 76-character lines per RFC 2045.
fn fold_base64(input: &str) -> String {
    let mut output = String::with_capacity(input.len() + input.len() / 76 * 2);
    for (i, ch) in input.chars().enumerate() {
        if i > 0 && i % 76 == 0 {
            output.push_str("\r\n");
        }
        output.push(ch);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_simple_text() {
        let msg = MimeBuilder::new()
            .from("alice@example.com")
            .to("bob@example.com")
            .subject("Hello")
            .text("Hello, Bob!")
            .build();

        let output = String::from_utf8_lossy(&msg);
        assert!(output.contains("From: alice@example.com\r\n"));
        assert!(output.contains("To: bob@example.com\r\n"));
        assert!(output.contains("Subject: Hello\r\n"));
        assert!(output.contains("Content-Type: text/plain; charset=utf-8\r\n"));
        assert!(output.contains("Hello, Bob!"));
        assert!(output.contains("MIME-Version: 1.0\r\n"));
    }

    #[test]
    fn test_build_with_attachment() {
        let msg = MimeBuilder::new()
            .from("alice@example.com")
            .to("bob@example.com")
            .subject("File attached")
            .text("See attached.")
            .attach("test.txt", b"file content".to_vec(), "text/plain")
            .build();

        let output = String::from_utf8_lossy(&msg);
        assert!(output.contains("multipart/mixed"));
        assert!(output.contains("Content-Disposition: attachment; filename=\"test.txt\""));
        assert!(output.contains("Content-Transfer-Encoding: base64"));
    }

    #[test]
    fn test_build_multipart_alternative() {
        let msg = MimeBuilder::new()
            .from("alice@example.com")
            .to("bob@example.com")
            .subject("Both formats")
            .text("Plain text")
            .html("<b>HTML text</b>")
            .build();

        let output = String::from_utf8_lossy(&msg);
        assert!(output.contains("multipart/alternative"));
        assert!(output.contains("text/plain"));
        assert!(output.contains("text/html"));
        assert!(output.contains("Plain text"));
        assert!(output.contains("<b>HTML text</b>"));
    }

    #[test]
    fn test_build_with_date() {
        use chrono::TimeZone;
        let dt = Utc.with_ymd_and_hms(2026, 1, 15, 10, 30, 0).unwrap();
        let msg = MimeBuilder::new()
            .from("a@b.com")
            .to("c@d.com")
            .subject("Dated")
            .date(dt)
            .text("body")
            .build();

        let output = String::from_utf8_lossy(&msg);
        assert!(output.contains("Date: "));
        assert!(output.contains("2026"));
    }

    #[test]
    fn test_build_multiple_to() {
        let msg = MimeBuilder::new()
            .from("a@b.com")
            .to("c@d.com")
            .to("e@f.com")
            .subject("Multi")
            .text("body")
            .build();

        let output = String::from_utf8_lossy(&msg);
        assert!(output.contains("To: c@d.com, e@f.com"));
    }
}
