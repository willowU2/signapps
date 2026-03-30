//! CardDAV client sync — IDEA-103
//!
//! Syncs contacts with external CardDAV servers (iCloud, Nextcloud, …).
//!
//! POST /api/v1/contacts/carddav/sync  — pull contacts from a remote server
//! GET  /api/v1/contacts/carddav/sync  — return last sync status

use axum::{extract::State, http::StatusCode, Json};
use chrono::Utc;
use reqwest::header::CONTENT_TYPE;
use serde::{Deserialize, Serialize};

use crate::carddav::{split_vcards, vcard_to_contact};
use crate::AppState;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
/// Request payload for CardDavSync operation.
pub struct CardDavSyncRequest {
    /// Full URL of the CardDAV addressbook, e.g.
    /// "https://icloud.com/.well-known/carddav" or
    /// "https://nextcloud.example.com/remote.php/dav/addressbooks/user/contacts/"
    pub server_url: String,
    pub username: String,
    /// App-specific password (never stored; used only for this request).
    pub password: String,
}

#[derive(Debug, Serialize)]
/// Represents a card dav sync result.
pub struct CardDavSyncResult {
    pub synced: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
    pub synced_at: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Fetch the vCard collection from a CardDAV server using HTTP Basic auth.
///
/// RFC 6352 defines REPORT as the proper method; many servers also respond
/// to a plain GET on the addressbook URL — we use GET for simplicity and
/// max compat.
async fn fetch_vcards_from_server(
    url: &str,
    username: &str,
    password: &str,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(url)
        .basic_auth(username, Some(password))
        .header(CONTENT_TYPE, "text/vcard")
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Server returned {}", resp.status()));
    }

    resp.text()
        .await
        .map_err(|e| format!("Failed to read body: {}", e))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

/// POST /api/v1/contacts/carddav/sync
///
/// Pulls contacts from the given CardDAV server and merges them into the
/// local contact store (deduplicating by UID).
pub async fn sync_carddav(
    State(state): State<AppState>,
    Json(req): Json<CardDavSyncRequest>,
) -> (StatusCode, Json<CardDavSyncResult>) {
    tracing::info!(url = %req.server_url, "Starting CardDAV sync");

    let vcard_body =
        match fetch_vcards_from_server(&req.server_url, &req.username, &req.password).await {
            Ok(body) => body,
            Err(e) => {
                tracing::error!("CardDAV fetch failed: {}", e);
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(CardDavSyncResult {
                        synced: 0,
                        skipped: 0,
                        errors: vec![e],
                        synced_at: Utc::now().to_rfc3339(),
                    }),
                );
            },
        };

    let blocks = split_vcards(&vcard_body);
    let mut synced = 0usize;
    let mut skipped = 0usize;
    let mut errors: Vec<String> = Vec::new();
    let mut store = state.contacts.lock().unwrap_or_else(|e| e.into_inner());

    for block in &blocks {
        match vcard_to_contact(block) {
            Some(mut contact) => {
                if let Some(existing) = store.iter_mut().find(|c| c.id == contact.id) {
                    // Update in-place (keep same ID)
                    existing.first_name = contact.first_name;
                    existing.last_name = contact.last_name;
                    existing.email = contact.email;
                    existing.phone = contact.phone;
                    existing.organization = contact.organization;
                    existing.job_title = contact.job_title;
                    existing.updated_at = Utc::now().to_rfc3339();
                } else {
                    contact.updated_at = Utc::now().to_rfc3339();
                    store.push(contact);
                }
                synced += 1;
            },
            None => {
                skipped += 1;
                errors.push("Skipped vCard: missing name field".to_string());
            },
        }
    }

    tracing::info!(synced, skipped, "CardDAV sync complete");
    (
        StatusCode::OK,
        Json(CardDavSyncResult {
            synced,
            skipped,
            errors,
            synced_at: Utc::now().to_rfc3339(),
        }),
    )
}
