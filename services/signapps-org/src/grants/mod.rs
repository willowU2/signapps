//! Access grant issuance, verification, and HTTP-layer redirect.
//!
//! The grant subsystem issues short-lived, HMAC-signed URLs that allow
//! an external (or unauthenticated) caller to reach a specific
//! resource with a bounded permission set. The flow is:
//!
//! 1. An authenticated user POSTs to `/api/v1/org/grants` with
//!    `{ tenant_id, resource_type, resource_id, permissions, expires_at }`.
//! 2. Server generates a UUID, builds a payload, signs it with the
//!    per-tenant HMAC secret (see [`token`]) and stores a SHA-256 hash
//!    of the token in `org_access_grants`.
//! 3. Client receives `{ id, token, url }`. The URL is
//!    `/g/<token>`.
//! 4. On visit, [`redirect`] re-verifies the token, bumps
//!    `last_used_at`, injects a `grant_token` cookie and 302-redirects
//!    to the resource URL.

pub mod redirect;
pub mod token;

use std::sync::Arc;

use signapps_keystore::Keystore;
use uuid::Uuid;

/// Derive the per-tenant HMAC secret used to sign grant tokens.
///
/// Prefers `Keystore::dek("org-grants-v1")` mixed with the tenant UUID
/// so every tenant has an independent secret. Falls back to the
/// `GRANT_HMAC_SECRET` env var when no keystore is available, which is
/// the stub path used by tests and bootstrap scripts.
///
/// Never logs the returned bytes.
pub fn tenant_hmac_secret(keystore: Option<&Arc<Keystore>>, tenant_id: Uuid) -> Vec<u8> {
    if let Some(ks) = keystore {
        let dek = ks.dek("org-grants-v1");
        // Mix the DEK with the tenant id so tenants cannot cross-verify
        // each other's tokens. SHA-256(dek || tenant_id_bytes).
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(dek.expose_bytes());
        hasher.update(tenant_id.as_bytes());
        return hasher.finalize().to_vec();
    }
    // Fallback: static env var (dev/test).
    std::env::var("GRANT_HMAC_SECRET")
        .unwrap_or_else(|_| "dev-grant-hmac-secret-change-me-in-production".to_string())
        .into_bytes()
}

/// Build the resource target URL for a resolved grant.
///
/// Used by the `/g/:token` redirect to compute the `Location` header.
/// Extend the match when new resource types are added.
#[must_use]
pub fn resource_target_url(resource_type: &str, resource_id: Uuid) -> String {
    match resource_type {
        "document" | "drive.file" | "doc" => format!("/docs/editor?id={resource_id}"),
        "folder" | "drive.folder" => format!("/drive?folder={resource_id}"),
        "calendar" => format!("/calendar?id={resource_id}"),
        "mail_folder" => format!("/mail?folder={resource_id}"),
        "form" => format!("/forms/{resource_id}"),
        "project" => format!("/projects/{resource_id}"),
        "board" => format!("/boards/{resource_id}"),
        _ => format!("/shared/{resource_type}/{resource_id}"),
    }
}

/// Structurally decode the token's payload segment and extract the
/// tenant id, **without** checking the HMAC signature.
///
/// Used by the redirect and verify handlers to pick the correct
/// tenant-scoped HMAC secret before running the real verification.
#[must_use]
pub fn peek_tenant_id(token_str: &str) -> Option<Uuid> {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    let (payload_b64, _) = token_str.split_once('.')?;
    let payload_bytes = URL_SAFE_NO_PAD.decode(payload_b64).ok()?;
    let payload: token::TokenPayload = serde_json::from_slice(&payload_bytes).ok()?;
    Some(payload.tenant_id)
}
