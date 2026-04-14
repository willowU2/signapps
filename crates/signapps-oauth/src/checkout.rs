//! Lazy refresh helper used by service handlers right before they call
//! the upstream API.
//!
//! Most calls hit the fast path (decrypt + return). Only when the token
//! is < 60 s from expiry do we make a synchronous request to identity's
//! `/api/v1/oauth/internal/refresh` endpoint, which performs the refresh
//! and returns the fresh access token.

use crate::error::OAuthError;
use crate::token_table::TokenTable;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_keystore::{decrypt_string, Keystore};
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use uuid::Uuid;

/// Result of a `checkout_token` call.
#[derive(Debug)]
pub struct TokenCheckout {
    /// Plaintext access token, ready to use as a Bearer.
    pub access_token: String,
    /// When the access token expires.
    pub expires_at: DateTime<Utc>,
}

/// Default freshness margin — refresh if the token is within this window.
pub const FRESHNESS_MARGIN: Duration = Duration::from_secs(60);

/// Get a usable access token for `id` in `table`, refreshing via
/// identity if necessary.
///
/// # Errors
///
/// - `OAuthError::Database` on row load failure
/// - `OAuthError::MissingParameter` if no expires_at recorded
/// - `OAuthError::Crypto` on decrypt failure
/// - `OAuthError::ProviderError` if identity's refresh endpoint fails
pub async fn checkout_token<T: TokenTable + ?Sized>(
    pool: &PgPool,
    keystore: &Arc<Keystore>,
    table: &T,
    id: Uuid,
    identity_base_url: &str,
    internal_token: &str,
) -> Result<TokenCheckout, OAuthError> {
    let enc = table.load(pool, id).await?;
    let expires_at = enc
        .expires_at
        .ok_or_else(|| OAuthError::MissingParameter("expires_at".into()))?;

    let dek = keystore.dek("oauth-tokens-v1");

    // Fast path: still fresh, decrypt and return.
    if expires_at > Utc::now() + chrono::Duration::from_std(FRESHNESS_MARGIN).unwrap() {
        let access_token = decrypt_string(&enc.access_token_enc, dek.as_ref())
            .map_err(|e| OAuthError::Crypto(e.to_string()))?;
        return Ok(TokenCheckout { access_token, expires_at });
    }

    // Slow path: ask identity to refresh.
    let resp = reqwest::Client::new()
        .post(format!("{identity_base_url}/api/v1/oauth/internal/refresh"))
        .header("X-Internal-Token", internal_token)
        .json(&InternalRefreshRequest { source_table: table.name().to_string(), source_id: id })
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| OAuthError::ProviderError {
            error: "refresh_call_failed".into(),
            description: Some(e.to_string()),
        })?;

    if !resp.status().is_success() {
        return Err(OAuthError::ProviderError {
            error: format!("refresh_http_{}", resp.status().as_u16()),
            description: resp.text().await.ok(),
        });
    }
    let body: InternalRefreshResponse = resp.json().await.map_err(|e| OAuthError::ProviderError {
        error: "refresh_response_invalid".into(),
        description: Some(e.to_string()),
    })?;
    Ok(TokenCheckout {
        access_token: body.access_token,
        expires_at: body.expires_at,
    })
}

#[derive(Serialize)]
struct InternalRefreshRequest {
    source_table: String,
    source_id: Uuid,
}

#[derive(Deserialize)]
struct InternalRefreshResponse {
    access_token: String,
    expires_at: DateTime<Utc>,
}
