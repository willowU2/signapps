//! CardDAV foundation — vCard (RFC 6350) import/export
//!
//! Implements:
//!   - `contact_to_vcard`  : serialize a Contact into a vCard 3.0 string
//!   - `vcard_to_contact`  : parse a vCard 3.0 string into a partial Contact
//!   - GET  /api/v1/contacts/export/vcf  — all contacts as a vCard collection
//!   - POST /api/v1/contacts/import/vcf  — create contacts from a vCard payload

use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use uuid::Uuid;

use crate::{AppState, Contact};

// ---------------------------------------------------------------------------
// vCard serialisation (RFC 6350 / 3.0 compat)
// ---------------------------------------------------------------------------

/// Serialize a single `Contact` into a vCard 3.0 string.
pub fn contact_to_vcard(c: &Contact) -> String {
    let mut lines = Vec::with_capacity(12);
    lines.push("BEGIN:VCARD".to_string());
    lines.push("VERSION:3.0".to_string());

    // FN (formatted name — required by RFC)
    let full = format!("{} {}", c.first_name, c.last_name);
    lines.push(format!("FN:{}", full.trim()));

    // N:Last;First;;;
    lines.push(format!("N:{};{};;;", c.last_name, c.first_name));

    if let Some(ref email) = c.email {
        lines.push(format!("EMAIL:{}", email));
    }
    if let Some(ref phone) = c.phone {
        lines.push(format!("TEL:{}", phone));
    }
    if let Some(ref org) = c.organization {
        lines.push(format!("ORG:{}", org));
    }
    if let Some(ref title) = c.job_title {
        lines.push(format!("TITLE:{}", title));
    }

    // UID tracks the original contact ID across sync clients
    lines.push(format!("UID:{}", c.id));

    lines.push("END:VCARD".to_string());
    lines.join("\r\n") + "\r\n"
}

/// Parse a single vCard 3.0 block into a `Contact`.
/// Returns `None` when the block is empty or lacks a name field.
pub fn vcard_to_contact(vcard_str: &str) -> Option<Contact> {
    let mut first_name = String::new();
    let mut last_name = String::new();
    let mut email: Option<String> = None;
    let mut phone: Option<String> = None;
    let mut organization: Option<String> = None;
    let mut job_title: Option<String> = None;
    let mut uid: Option<Uuid> = None;

    for raw_line in vcard_str.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }

        // Split on the first ':'
        let (prop, value) = match line.split_once(':') {
            Some(pair) => pair,
            None => continue,
        };

        // Property names can carry parameters (e.g. EMAIL;TYPE=work), strip them
        let prop_name = prop.split(';').next().unwrap_or(prop).to_uppercase();

        match prop_name.as_str() {
            "N" => {
                // N:Last;First;Additional;Prefix;Suffix
                let parts: Vec<&str> = value.splitn(5, ';').collect();
                last_name = parts.first().unwrap_or(&"").to_string();
                first_name = parts.get(1).unwrap_or(&"").to_string();
            },
            "FN" => {
                // Only use FN as fallback when N is absent
                if first_name.is_empty() && last_name.is_empty() {
                    let mut words = value.splitn(2, ' ');
                    first_name = words.next().unwrap_or("").to_string();
                    last_name = words.next().unwrap_or("").to_string();
                }
            },
            "EMAIL" => email = Some(value.to_string()),
            "TEL" => phone = Some(value.to_string()),
            "ORG" => organization = Some(value.split(';').next().unwrap_or(value).to_string()),
            "TITLE" => job_title = Some(value.to_string()),
            "UID" => uid = Uuid::parse_str(value).ok(),
            _ => {},
        }
    }

    if first_name.is_empty() && last_name.is_empty() {
        return None;
    }

    let now = Utc::now().to_rfc3339();
    Some(Contact {
        id: uid.unwrap_or_else(Uuid::new_v4),
        owner_id: Uuid::nil(), // caller must set the real owner_id
        first_name,
        last_name,
        email,
        phone,
        organization,
        job_title,
        group_ids: Vec::new(),
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Split a vCard collection (multiple VCARD blocks) into individual blocks.
fn split_vcards(input: &str) -> Vec<&str> {
    let mut blocks = Vec::new();
    let mut start: Option<usize> = None;

    for line in input.split('\n') {
        let trimmed = line.trim();
        if trimmed.eq_ignore_ascii_case("BEGIN:VCARD") {
            // find the byte offset in the original string
            if let Some(pos) = input.find(line) {
                start = Some(pos);
            }
        } else if trimmed.eq_ignore_ascii_case("END:VCARD") {
            if let Some(s) = start.take() {
                let end = input[s..]
                    .find("END:VCARD")
                    .map(|e| s + e + "END:VCARD".len());
                if let Some(e) = end {
                    blocks.push(&input[s..e]);
                }
            }
        }
    }
    blocks
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

/// GET /api/v1/contacts/export/vcf
///
/// Returns all contacts in the in-memory store as a `text/vcard` collection.
pub async fn export_vcf(State(state): State<AppState>) -> Response {
    let contacts = state.contacts.lock().unwrap_or_else(|e| e.into_inner());
    let body: String = contacts.iter().map(contact_to_vcard).collect();

    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "text/vcard; charset=utf-8"),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=\"contacts.vcf\"",
            ),
        ],
        body,
    )
        .into_response()
}

/// POST /api/v1/contacts/import/vcf
///
/// Accepts a `text/vcard` body, parses each VCARD block, and inserts the
/// resulting contacts into the in-memory store.
/// Returns the list of newly created contacts as JSON.
pub async fn import_vcf(
    State(state): State<AppState>,
    body: String,
) -> (StatusCode, Json<serde_json::Value>) {
    let blocks = split_vcards(&body);

    if blocks.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "No valid VCARD blocks found" })),
        );
    }

    let mut created: Vec<Contact> = Vec::new();
    let mut store = state.contacts.lock().unwrap_or_else(|e| e.into_inner());

    for block in blocks {
        if let Some(mut contact) = vcard_to_contact(block) {
            // Avoid duplicate UIDs already present in the store
            if store.iter().any(|c| c.id == contact.id) {
                contact.id = Uuid::new_v4();
            }
            tracing::info!(id = %contact.id, "Contact imported via vCard");
            store.push(contact.clone());
            created.push(contact);
        }
    }

    let count = created.len();
    (
        StatusCode::CREATED,
        Json(serde_json::json!({
            "imported": count,
            "contacts": created,
        })),
    )
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_contact() -> Contact {
        let now = Utc::now().to_rfc3339();
        Contact {
            id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap(),
            owner_id: Uuid::nil(),
            first_name: "Jean".to_string(),
            last_name: "Dupont".to_string(),
            email: Some("jean.dupont@example.com".to_string()),
            phone: Some("+33123456789".to_string()),
            organization: Some("Acme".to_string()),
            job_title: Some("Développeur".to_string()),
            group_ids: Vec::new(),
            created_at: now.clone(),
            updated_at: now,
        }
    }

    #[test]
    fn roundtrip_vcard() {
        let original = sample_contact();
        let vcard = contact_to_vcard(&original);

        assert!(vcard.contains("BEGIN:VCARD"));
        assert!(vcard.contains("END:VCARD"));
        assert!(vcard.contains("FN:Jean Dupont"));
        assert!(vcard.contains("N:Dupont;Jean;;;"));
        assert!(vcard.contains("EMAIL:jean.dupont@example.com"));
        assert!(vcard.contains("TEL:+33123456789"));
        assert!(vcard.contains("ORG:Acme"));
        assert!(vcard.contains("TITLE:Développeur"));

        let parsed = vcard_to_contact(&vcard).expect("parse must succeed");
        assert_eq!(parsed.first_name, original.first_name);
        assert_eq!(parsed.last_name, original.last_name);
        assert_eq!(parsed.email, original.email);
        assert_eq!(parsed.phone, original.phone);
        assert_eq!(parsed.organization, original.organization);
        assert_eq!(parsed.job_title, original.job_title);
        assert_eq!(parsed.id, original.id); // UID preserved
    }

    #[test]
    fn parse_minimal_vcard() {
        let vcard = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Alice Martin\r\nEND:VCARD\r\n";
        let contact = vcard_to_contact(vcard).expect("should parse minimal vCard");
        assert_eq!(contact.first_name, "Alice");
        assert_eq!(contact.last_name, "Martin");
    }

    #[test]
    fn parse_empty_returns_none() {
        assert!(vcard_to_contact("BEGIN:VCARD\r\nVERSION:3.0\r\nEND:VCARD\r\n").is_none());
    }

    #[test]
    fn split_multiple_vcards() {
        let two_cards = concat!(
            "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Alice\r\nEND:VCARD\r\n",
            "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Bob\r\nEND:VCARD\r\n",
        );
        let blocks = split_vcards(two_cards);
        assert_eq!(blocks.len(), 2);
    }
}
