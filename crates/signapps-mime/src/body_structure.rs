//! IMAP BODYSTRUCTURE JSON builder.
//!
//! Converts a parsed [`MimeMessage`] into a JSON representation compatible
//! with the IMAP BODYSTRUCTURE response format (RFC 3501 section 7.4.2).

use serde_json::{json, Value};

use crate::headers::ContentType;
use crate::{MimeBody, MimeMessage};

/// Build an IMAP-style BODYSTRUCTURE JSON for a parsed message.
///
/// The output follows the IMAP BODYSTRUCTURE format:
/// - Leaf parts: `{ type, subtype, params, id, description, encoding, size, ... }`
/// - Multipart: `{ type: "multipart", subtype, parts: [...] }`
///
/// # Panics
///
/// None.
///
/// # Examples
///
/// ```
/// let raw = b"Content-Type: text/plain\r\n\r\nHello";
/// let msg = signapps_mime::MimeMessage::parse(raw).unwrap();
/// let bs = signapps_mime::body_structure::build_body_structure(&msg);
/// assert_eq!(bs["type"], "text");
/// assert_eq!(bs["subtype"], "plain");
/// ```
pub fn build_body_structure(msg: &MimeMessage) -> Value {
    build_body_node(&msg.headers, &msg.body)
}

/// Recursively build a BODYSTRUCTURE node.
fn build_body_node(headers: &crate::Headers, body: &MimeBody) -> Value {
    match body {
        MimeBody::Multipart { subtype, parts, .. } => {
            let child_nodes: Vec<Value> = parts
                .iter()
                .map(|p| build_body_node(&p.headers, &p.body))
                .collect();

            json!({
                "type": "multipart",
                "subtype": subtype,
                "parts": child_nodes
            })
        },
        MimeBody::Text(text) => {
            let ct = headers
                .get("Content-Type")
                .map(ContentType::parse)
                .unwrap_or_else(|| ContentType::parse("text/plain"));

            let (type_part, subtype) = split_mime_type(&ct.mime_type);

            json!({
                "type": type_part,
                "subtype": subtype,
                "params": ct_params_to_json(&ct),
                "id": headers.get("Content-ID"),
                "description": headers.get("Content-Description"),
                "encoding": headers.get("Content-Transfer-Encoding").unwrap_or("7bit"),
                "size": text.len(),
                "lines": text.lines().count()
            })
        },
        MimeBody::Binary(data) => {
            let ct = headers
                .get("Content-Type")
                .map(ContentType::parse)
                .unwrap_or_else(|| ContentType::parse("application/octet-stream"));

            let (type_part, subtype) = split_mime_type(&ct.mime_type);

            json!({
                "type": type_part,
                "subtype": subtype,
                "params": ct_params_to_json(&ct),
                "id": headers.get("Content-ID"),
                "description": headers.get("Content-Description"),
                "encoding": headers.get("Content-Transfer-Encoding").unwrap_or("base64"),
                "size": data.len()
            })
        },
    }
}

/// Split a MIME type string into type and subtype.
fn split_mime_type(mime: &str) -> (&str, &str) {
    if let Some(pos) = mime.find('/') {
        (&mime[..pos], &mime[pos + 1..])
    } else {
        (mime, "")
    }
}

/// Convert Content-Type parameters to a JSON object.
fn ct_params_to_json(ct: &ContentType) -> Value {
    if ct.params.is_empty() {
        Value::Null
    } else {
        let obj: serde_json::Map<String, Value> = ct
            .params
            .iter()
            .map(|(k, v)| (k.clone(), Value::String(v.clone())))
            .collect();
        Value::Object(obj)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_body_structure_simple_text() {
        let raw = b"Content-Type: text/plain; charset=utf-8\r\n\r\nHello World";
        let msg = MimeMessage::parse(raw).unwrap();
        let bs = build_body_structure(&msg);

        assert_eq!(bs["type"], "text");
        assert_eq!(bs["subtype"], "plain");
        assert_eq!(bs["params"]["charset"], "utf-8");
        assert_eq!(bs["size"], 11);
    }

    #[test]
    fn test_body_structure_multipart() {
        let raw = b"Content-Type: multipart/alternative; boundary=\"b1\"\r\n\
                     \r\n\
                     --b1\r\n\
                     Content-Type: text/plain\r\n\
                     \r\n\
                     Plain\r\n\
                     --b1\r\n\
                     Content-Type: text/html\r\n\
                     \r\n\
                     <b>HTML</b>\r\n\
                     --b1--\r\n";

        let msg = MimeMessage::parse(raw).unwrap();
        let bs = build_body_structure(&msg);

        assert_eq!(bs["type"], "multipart");
        assert_eq!(bs["subtype"], "alternative");

        let parts = bs["parts"].as_array().unwrap();
        assert_eq!(parts.len(), 2);
        assert_eq!(parts[0]["type"], "text");
        assert_eq!(parts[0]["subtype"], "plain");
        assert_eq!(parts[1]["type"], "text");
        assert_eq!(parts[1]["subtype"], "html");
    }
}
