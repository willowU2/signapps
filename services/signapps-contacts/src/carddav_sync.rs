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

#[derive(Debug, Deserialize, utoipa::ToSchema)]
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

#[derive(Debug, Serialize, utoipa::ToSchema)]
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
///
/// Note: CardDAV uses non-standard HTTP methods (PROPFIND, REPORT) for
/// addressbook discovery. This endpoint uses a plain GET to fetch the vCard
/// collection for maximum server compatibility.
#[utoipa::path(
    post,
    path = "/api/v1/contacts/carddav/sync",
    request_body = CardDavSyncRequest,
    responses(
        (status = 200, description = "Sync completed", body = CardDavSyncResult),
        (status = 502, description = "CardDAV server unreachable or returned an error", body = CardDavSyncResult),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "CardDAV",
)]
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
    let pool = state.pool.inner();

    for block in &blocks {
        match vcard_to_contact(block) {
            Some(contact) => {
                // Upsert by UID
                let res = sqlx::query(
                    "INSERT INTO contacts
                        (id, owner_id, first_name, last_name, email, phone, organization, job_title)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     ON CONFLICT (id) DO UPDATE SET
                        first_name = EXCLUDED.first_name,
                        last_name  = EXCLUDED.last_name,
                        email      = EXCLUDED.email,
                        phone      = EXCLUDED.phone,
                        organization = EXCLUDED.organization,
                        job_title  = EXCLUDED.job_title,
                        updated_at = NOW()",
                )
                .bind(contact.id)
                .bind(contact.owner_id)
                .bind(&contact.first_name)
                .bind(&contact.last_name)
                .bind(&contact.email)
                .bind(&contact.phone)
                .bind(&contact.organization)
                .bind(&contact.job_title)
                .execute(pool)
                .await;
                if res.is_ok() {
                    synced += 1;
                } else {
                    skipped += 1;
                    errors.push("DB upsert failed".into());
                }
            }
            None => {
                skipped += 1;
                errors.push("Skipped vCard: missing name field".to_string());
            }
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
