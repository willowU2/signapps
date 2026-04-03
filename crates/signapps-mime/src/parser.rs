//! Recursive MIME multipart parser.
//!
//! Splits raw email bytes into a structured [`MimeMessage`] tree, handling
//! nested multipart containers, content-transfer-encoding, and boundary detection.

use crate::encoding::{decode_base64, decode_quoted_printable};
use crate::headers::{ContentType, Headers};
use crate::{MimeBody, MimeError, MimeMessage, MimePart};

/// Parse a raw RFC 5322 email message into a [`MimeMessage`].
///
/// The parser:
/// 1. Splits headers from body at the first `\r\n\r\n` (or `\n\n`).
/// 2. Determines Content-Type and Content-Transfer-Encoding.
/// 3. For multipart types, recursively parses each boundary-delimited part.
/// 4. For leaf parts, decodes the body according to the transfer encoding.
///
/// # Errors
///
/// Returns [`MimeError::InvalidStructure`] if the message cannot be parsed.
///
/// # Panics
///
/// None.
pub fn parse_message(raw: &[u8]) -> Result<MimeMessage, MimeError> {
    let raw_str = String::from_utf8_lossy(raw);

    let (header_section, body_section) = split_header_body(&raw_str);
    let headers = Headers::parse(header_section);
    let body = parse_body(&headers, body_section)?;

    Ok(MimeMessage {
        headers,
        body,
        raw: raw.to_vec(),
    })
}

/// Split raw message text into header section and body section.
///
/// Splits on `\r\n\r\n` or `\n\n`.
fn split_header_body(raw: &str) -> (&str, &str) {
    if let Some(pos) = raw.find("\r\n\r\n") {
        (&raw[..pos], &raw[pos + 4..])
    } else if let Some(pos) = raw.find("\n\n") {
        (&raw[..pos], &raw[pos + 2..])
    } else {
        // No body — entire message is headers
        (raw, "")
    }
}

/// Parse the body section given the headers that describe it.
fn parse_body(headers: &Headers, body: &str) -> Result<MimeBody, MimeError> {
    let ct = headers
        .get("Content-Type")
        .map(ContentType::parse)
        .unwrap_or_else(|| ContentType::parse("text/plain"));

    if ct.is_multipart() {
        let boundary = ct.param("boundary").ok_or_else(|| {
            MimeError::InvalidStructure("multipart without boundary parameter".into())
        })?;
        let parts = split_by_boundary(body, boundary)?;

        let mut parsed_parts = Vec::with_capacity(parts.len());
        for part_raw in parts {
            let (ph, pb) = split_header_body(part_raw);
            let part_headers = Headers::parse(ph);
            let part_body = parse_body(&part_headers, pb)?;
            parsed_parts.push(MimePart {
                headers: part_headers,
                body: part_body,
            });
        }

        let subtype = ct.multipart_subtype().unwrap_or("mixed").to_string();

        Ok(MimeBody::Multipart {
            subtype,
            boundary: boundary.to_string(),
            parts: parsed_parts,
        })
    } else {
        decode_leaf_body(headers, body, &ct)
    }
}

/// Decode a leaf (non-multipart) body according to Content-Transfer-Encoding.
fn decode_leaf_body(
    headers: &Headers,
    body: &str,
    ct: &ContentType,
) -> Result<MimeBody, MimeError> {
    let encoding = headers
        .get("Content-Transfer-Encoding")
        .unwrap_or("7bit")
        .trim()
        .to_ascii_lowercase();

    let decoded_bytes = match encoding.as_str() {
        "base64" => decode_base64(body)?,
        "quoted-printable" => decode_quoted_printable(body)?,
        _ => body.as_bytes().to_vec(), // 7bit, 8bit, binary
    };

    // Determine if this is text or binary
    if ct.mime_type.starts_with("text/") {
        let charset = ct.param("charset").unwrap_or("utf-8").to_ascii_lowercase();
        let text = if charset == "utf-8" || charset == "us-ascii" || charset == "ascii" {
            String::from_utf8_lossy(&decoded_bytes).into_owned()
        } else {
            // Best-effort: try UTF-8, fallback to Latin-1
            String::from_utf8(decoded_bytes.clone())
                .unwrap_or_else(|_| decoded_bytes.iter().map(|&b| b as char).collect())
        };
        Ok(MimeBody::Text(text))
    } else {
        Ok(MimeBody::Binary(decoded_bytes))
    }
}

/// Split a body by MIME boundary markers.
///
/// Returns the text between `--boundary` delimiters. The closing `--boundary--`
/// marks the end.
fn split_by_boundary<'a>(body: &'a str, boundary: &str) -> Result<Vec<&'a str>, MimeError> {
    let delim = format!("--{}", boundary);
    let mut parts = Vec::new();
    let mut remaining = body;

    // Find the first boundary (preamble is discarded)
    if let Some(pos) = remaining.find(&delim) {
        remaining = &remaining[pos + delim.len()..];
        // Skip CRLF or LF after the boundary
        remaining = skip_line_ending(remaining);
    } else {
        return Ok(Vec::new());
    }

    // Find subsequent boundaries
    loop {
        if let Some(pos) = remaining.find(&delim) {
            let part = &remaining[..pos];
            // Trim trailing CRLF before the boundary
            let part = part
                .strip_suffix("\r\n")
                .or_else(|| part.strip_suffix("\n"))
                .unwrap_or(part);
            parts.push(part);

            remaining = &remaining[pos + delim.len()..];

            // Check if this is the closing boundary
            if remaining.starts_with("--") {
                break;
            }

            // Skip CRLF after boundary
            remaining = skip_line_ending(remaining);
        } else {
            // No more boundaries — the rest is the last part (unusual but handle gracefully)
            let part = remaining.trim_end();
            if !part.is_empty() {
                parts.push(part);
            }
            break;
        }
    }

    Ok(parts)
}

/// Skip a leading `\r\n` or `\n`.
fn skip_line_ending(s: &str) -> &str {
    if let Some(rest) = s.strip_prefix("\r\n") {
        rest
    } else if let Some(rest) = s.strip_prefix('\n') {
        rest
    } else {
        s
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

        let msg = parse_message(raw).unwrap();
        assert_eq!(msg.headers.get("From"), Some("alice@example.com"));
        assert_eq!(msg.headers.get("Subject"), Some("Hello"));

        match &msg.body {
            MimeBody::Text(text) => assert!(text.contains("Hello, Bob!")),
            _ => panic!("expected text body"),
        }
    }

    #[test]
    fn test_parse_multipart_alternative() {
        let raw = b"From: alice@example.com\r\n\
                     Content-Type: multipart/alternative; boundary=\"bound1\"\r\n\
                     \r\n\
                     --bound1\r\n\
                     Content-Type: text/plain\r\n\
                     \r\n\
                     Plain text body\r\n\
                     --bound1\r\n\
                     Content-Type: text/html\r\n\
                     \r\n\
                     <html><body>HTML body</body></html>\r\n\
                     --bound1--\r\n";

        let msg = parse_message(raw).unwrap();
        match &msg.body {
            MimeBody::Multipart { subtype, parts, .. } => {
                assert_eq!(subtype, "alternative");
                assert_eq!(parts.len(), 2);

                match &parts[0].body {
                    MimeBody::Text(t) => assert!(t.contains("Plain text body")),
                    _ => panic!("expected text"),
                }
                match &parts[1].body {
                    MimeBody::Text(t) => assert!(t.contains("HTML body")),
                    _ => panic!("expected html"),
                }
            },
            _ => panic!("expected multipart"),
        }
    }

    #[test]
    fn test_parse_base64_body() {
        let raw = b"Content-Type: text/plain\r\n\
                     Content-Transfer-Encoding: base64\r\n\
                     \r\n\
                     SGVsbG8sIFdvcmxkIQ==\r\n";

        let msg = parse_message(raw).unwrap();
        match &msg.body {
            MimeBody::Text(t) => assert_eq!(t, "Hello, World!"),
            _ => panic!("expected text body"),
        }
    }

    #[test]
    fn test_parse_quoted_printable_body() {
        let raw = b"Content-Type: text/plain; charset=utf-8\r\n\
                     Content-Transfer-Encoding: quoted-printable\r\n\
                     \r\n\
                     Hello=20World\r\n";

        let msg = parse_message(raw).unwrap();
        match &msg.body {
            MimeBody::Text(t) => assert!(t.contains("Hello World")),
            _ => panic!("expected text body"),
        }
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
                     Content-Type: application/octet-stream\r\n\
                     Content-Transfer-Encoding: base64\r\n\
                     \r\n\
                     AQIDBA==\r\n\
                     --outer--\r\n";

        let msg = parse_message(raw).unwrap();
        match &msg.body {
            MimeBody::Multipart { subtype, parts, .. } => {
                assert_eq!(subtype, "mixed");
                assert_eq!(parts.len(), 2);

                // First part should be nested multipart
                match &parts[0].body {
                    MimeBody::Multipart { subtype, parts, .. } => {
                        assert_eq!(subtype, "alternative");
                        assert_eq!(parts.len(), 2);
                    },
                    _ => panic!("expected nested multipart"),
                }

                // Second part should be binary
                match &parts[1].body {
                    MimeBody::Binary(data) => assert_eq!(data, &[1, 2, 3, 4]),
                    _ => panic!("expected binary"),
                }
            },
            _ => panic!("expected multipart"),
        }
    }
}
