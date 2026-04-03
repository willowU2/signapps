//! Encoding/decoding utilities for MIME content.
//!
//! Provides base64, quoted-printable, and RFC 2047 encoded-word support.

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;

use crate::MimeError;

/// Decode a base64-encoded string into raw bytes.
///
/// Ignores whitespace in the input (common in MIME bodies).
///
/// # Errors
///
/// Returns [`MimeError::Base64`] if the input contains invalid base64 characters.
///
/// # Examples
///
/// ```
/// let data = signapps_mime::encoding::decode_base64("SGVsbG8=").unwrap();
/// assert_eq!(data, b"Hello");
/// ```
pub fn decode_base64(input: &str) -> Result<Vec<u8>, MimeError> {
    let cleaned: String = input.chars().filter(|c| !c.is_ascii_whitespace()).collect();
    BASE64_STANDARD
        .decode(&cleaned)
        .map_err(|e| MimeError::Base64(e.to_string()))
}

/// Encode raw bytes into a base64 string.
///
/// # Panics
///
/// None.
///
/// # Examples
///
/// ```
/// let encoded = signapps_mime::encoding::encode_base64(b"Hello");
/// assert_eq!(encoded, "SGVsbG8=");
/// ```
pub fn encode_base64(input: &[u8]) -> String {
    BASE64_STANDARD.encode(input)
}

/// Decode a quoted-printable encoded string into raw bytes.
///
/// Handles soft line-breaks (`=\r\n`) and `=XX` hex escapes per RFC 2045.
///
/// # Errors
///
/// Returns [`MimeError::QuotedPrintable`] if an `=XX` sequence contains invalid hex.
///
/// # Examples
///
/// ```
/// let data = signapps_mime::encoding::decode_quoted_printable("Hello=20World").unwrap();
/// assert_eq!(data, b"Hello World");
/// ```
pub fn decode_quoted_printable(input: &str) -> Result<Vec<u8>, MimeError> {
    let mut output = Vec::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        if bytes[i] == b'=' {
            // Soft line-break: =\r\n or =\n
            if i + 1 < bytes.len() && bytes[i + 1] == b'\n' {
                i += 2;
                continue;
            }
            if i + 2 < bytes.len() && bytes[i + 1] == b'\r' && bytes[i + 2] == b'\n' {
                i += 3;
                continue;
            }
            // Hex escape =XX
            if i + 2 < bytes.len() {
                let hi = bytes[i + 1];
                let lo = bytes[i + 2];
                let byte = decode_hex_pair(hi, lo).ok_or_else(|| {
                    MimeError::QuotedPrintable(format!(
                        "invalid hex escape: ={}{}",
                        hi as char, lo as char
                    ))
                })?;
                output.push(byte);
                i += 3;
            } else {
                // Trailing '=' without enough chars — treat literally
                output.push(b'=');
                i += 1;
            }
        } else {
            output.push(bytes[i]);
            i += 1;
        }
    }

    Ok(output)
}

/// Encode raw bytes into quoted-printable format.
///
/// # Panics
///
/// None.
///
/// # Examples
///
/// ```
/// let encoded = signapps_mime::encoding::encode_quoted_printable(b"Hello World\xC3\xA9");
/// assert!(encoded.contains("=C3=A9"));
/// ```
pub fn encode_quoted_printable(input: &[u8]) -> String {
    let mut output = String::with_capacity(input.len() * 2);
    let mut line_len = 0;

    for &byte in input {
        let encoded = if byte == b'\r' || byte == b'\n' {
            output.push(byte as char);
            line_len = 0;
            continue;
        } else if byte == b'\t' || ((33..=126).contains(&byte) && byte != b'=') {
            // Printable ASCII (except '=')
            if line_len >= 75 {
                output.push_str("=\r\n");
                line_len = 0;
            }
            output.push(byte as char);
            line_len += 1;
            continue;
        } else {
            format!("={:02X}", byte)
        };

        if line_len + encoded.len() >= 76 {
            output.push_str("=\r\n");
            line_len = 0;
        }
        output.push_str(&encoded);
        line_len += encoded.len();
    }

    output
}

/// Decode an RFC 2047 encoded-word string.
///
/// Handles both `=?charset?B?...?=` (base64) and `=?charset?Q?...?=` (quoted-printable)
/// forms. Non-encoded text is passed through unchanged. Multiple encoded words
/// separated only by whitespace are concatenated per RFC 2047 section 6.2.
///
/// # Panics
///
/// None — invalid encoded words are returned literally.
///
/// # Examples
///
/// ```
/// let decoded = signapps_mime::encoding::decode_rfc2047("=?UTF-8?B?SGVsbG8gV29ybGQ=?=");
/// assert_eq!(decoded, "Hello World");
/// ```
pub fn decode_rfc2047(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let mut remaining = input;

    while !remaining.is_empty() {
        if let Some(start) = remaining.find("=?") {
            // Add text before the encoded word
            result.push_str(&remaining[..start]);

            let after_start = &remaining[start + 2..];
            if let Some(end) = find_encoded_word_end(after_start) {
                let encoded_part = &after_start[..end];
                let decoded = decode_single_encoded_word(encoded_part);
                result.push_str(&decoded);
                remaining = &after_start[end + 2..]; // skip past ?=

                // RFC 2047 6.2: skip whitespace between consecutive encoded words
                if remaining.starts_with("=?")
                    || (remaining.starts_with(|c: char| c.is_ascii_whitespace())
                        && remaining.trim_start().starts_with("=?"))
                {
                    remaining = remaining.trim_start();
                }
            } else {
                // Malformed — push the =? and continue
                result.push_str("=?");
                remaining = after_start;
            }
        } else {
            result.push_str(remaining);
            break;
        }
    }

    result
}

/// Find the end of an encoded word (the `?=` terminator).
///
/// Returns the offset of `?` in `?=` relative to the content after `=?`.
fn find_encoded_word_end(s: &str) -> Option<usize> {
    // We need at least charset?encoding?text?=
    // Find the ?= that ends the word, but skip the first two ? separators
    let mut question_count = 0;
    for (i, ch) in s.char_indices() {
        if ch == '?' {
            question_count += 1;
            if question_count >= 3 && i + 1 < s.len() && s.as_bytes()[i + 1] == b'=' {
                return Some(i);
            }
        }
    }
    None
}

/// Decode a single encoded word (content between `=?` and `?=`).
///
/// Expected format: `charset?encoding?encoded_text`
fn decode_single_encoded_word(content: &str) -> String {
    let parts: Vec<&str> = content.splitn(3, '?').collect();
    if parts.len() != 3 {
        return format!("=?{}?=", content);
    }

    let _charset = parts[0]; // We assume UTF-8 or Latin-1 for now
    let encoding = parts[1].to_ascii_uppercase();
    let text = parts[2];

    let bytes = match encoding.as_str() {
        "B" => decode_base64(text).unwrap_or_else(|_| text.as_bytes().to_vec()),
        "Q" => {
            // RFC 2047 Q-encoding: like QP but _ means space
            let replaced = text.replace('_', " ");
            decode_quoted_printable(&replaced).unwrap_or_else(|_| text.as_bytes().to_vec())
        },
        _ => return format!("=?{}?=", content),
    };

    String::from_utf8(bytes).unwrap_or_else(|e| {
        // Try Latin-1 fallback
        e.into_bytes().iter().map(|&b| b as char).collect()
    })
}

/// Decode a single hex pair into a byte.
fn decode_hex_pair(hi: u8, lo: u8) -> Option<u8> {
    let h = hex_digit(hi)?;
    let l = hex_digit(lo)?;
    Some((h << 4) | l)
}

/// Convert an ASCII hex digit to its numeric value.
fn hex_digit(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'A'..=b'F' => Some(b - b'A' + 10),
        b'a'..=b'f' => Some(b - b'a' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base64_roundtrip() {
        let original = b"Hello, MIME world!";
        let encoded = encode_base64(original);
        let decoded = decode_base64(&encoded).unwrap();
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_base64_with_whitespace() {
        let encoded = "SGVs\r\nbG8=";
        let decoded = decode_base64(encoded).unwrap();
        assert_eq!(decoded, b"Hello");
    }

    #[test]
    fn test_quoted_printable_decode() {
        let input = "Hello=20World=0D=0A";
        let decoded = decode_quoted_printable(input).unwrap();
        assert_eq!(decoded, b"Hello World\r\n");
    }

    #[test]
    fn test_quoted_printable_soft_linebreak() {
        let input = "Hello=\r\n World";
        let decoded = decode_quoted_printable(input).unwrap();
        assert_eq!(decoded, b"Hello World");
    }

    #[test]
    fn test_quoted_printable_roundtrip() {
        let original = b"Caf\xC3\xA9 & th\xC3\xA9";
        let encoded = encode_quoted_printable(original);
        let decoded = decode_quoted_printable(&encoded).unwrap();
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_rfc2047_base64() {
        let input = "=?UTF-8?B?SGVsbG8gV29ybGQ=?=";
        assert_eq!(decode_rfc2047(input), "Hello World");
    }

    #[test]
    fn test_rfc2047_quoted_printable() {
        let input = "=?UTF-8?Q?Caf=C3=A9?=";
        assert_eq!(decode_rfc2047(input), "Caf\u{00e9}"); // e-acute (UTF-8: C3 A9)
    }

    #[test]
    fn test_rfc2047_passthrough() {
        let input = "Just plain text";
        assert_eq!(decode_rfc2047(input), "Just plain text");
    }

    #[test]
    fn test_rfc2047_underscore_as_space() {
        let input = "=?UTF-8?Q?Hello_World?=";
        assert_eq!(decode_rfc2047(input), "Hello World");
    }
}
