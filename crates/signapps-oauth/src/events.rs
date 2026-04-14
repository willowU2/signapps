//! Event payloads for cross-service OAuth pipeline.
//!
//! Published by `signapps-identity` after a successful OAuth flow.
//! Consumed by per-service workers (mail, calendar, social) that store
//! the encrypted tokens in their own tables.
//!
//! Format on the wire: serde_json into `platform.events.payload`.

use crate::protocol::{OAuthPurpose, ProviderCategory};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Event type string for the `event_type` column in `platform.events`.
pub const EVENT_OAUTH_TOKENS_ACQUIRED: &str = "oauth.tokens.acquired";

/// Event type string for the token-invalidation event (used in Plan 5
/// when the refresh job exhausts retries).
pub const EVENT_OAUTH_TOKEN_INVALIDATED: &str = "oauth.tokens.invalidated";

/// Emitted by `signapps-identity` after a successful OAuth callback.
///
/// Token bytes (`access_token_enc`, `refresh_token_enc`) are AES-GCM
/// ciphertexts under DEK `oauth-tokens-v1` — consumers decrypt with
/// the same DEK before use.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokensAcquired {
    /// User who completed the flow (None means a new user from `Login`
    /// — the `provider_user_email` is the canonical identifier in that
    /// case and the consumer should look up by email).
    pub user_id: Option<Uuid>,
    /// Tenant scope.
    pub tenant_id: Uuid,
    /// Provider key (e.g., "google", "microsoft").
    pub provider_key: String,
    /// Login (SSO) or Integration (mail/calendar/...).
    pub purpose: OAuthPurpose,
    /// Primary category — consumers use this to filter (`mail` only
    /// reacts to events with category Mail, etc.). Helps avoid
    /// every consumer waking up for every event.
    pub category: ProviderCategory,
    /// Encrypted access token.
    pub access_token_enc: Vec<u8>,
    /// Encrypted refresh token (None if the provider doesn't issue one,
    /// e.g., GitHub).
    pub refresh_token_enc: Option<Vec<u8>>,
    /// When the access token expires (None if the provider doesn't tell us).
    pub expires_at: Option<DateTime<Utc>>,
    /// Scopes the provider actually granted (may be a subset of requested).
    pub scopes_granted: Vec<String>,
    /// Provider's user ID (e.g., Google's `sub`, GitHub's `id`).
    pub provider_user_id: String,
    /// Provider's user email (if available).
    pub provider_user_email: Option<String>,
}

/// Emitted by the refresh job (Plan 5) when a token cannot be refreshed
/// after retry exhaustion — consumers should mark their account row as
/// "needs reconnection" and notify the user.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokenInvalidated {
    /// User whose token broke.
    pub user_id: Uuid,
    /// Tenant scope.
    pub tenant_id: Uuid,
    /// Provider key.
    pub provider_key: String,
    /// Which table held the broken token (e.g., "mail.accounts").
    pub source_table: String,
    /// Row ID in that table.
    pub source_id: Uuid,
    /// Human-readable reason (last error from the refresh attempt).
    pub reason: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serde_roundtrip_acquired() {
        let ev = OAuthTokensAcquired {
            user_id: Some(Uuid::new_v4()),
            tenant_id: Uuid::new_v4(),
            provider_key: "google".into(),
            purpose: OAuthPurpose::Integration,
            category: ProviderCategory::Mail,
            access_token_enc: vec![0x01, 0x02, 0x03],
            refresh_token_enc: Some(vec![0x04, 0x05]),
            expires_at: None,
            scopes_granted: vec!["openid".into()],
            provider_user_id: "12345".into(),
            provider_user_email: Some("u@example.com".into()),
        };
        let json = serde_json::to_string(&ev).unwrap();
        let back: OAuthTokensAcquired = serde_json::from_str(&json).unwrap();
        assert_eq!(back.provider_key, "google");
        assert_eq!(back.access_token_enc, vec![0x01, 0x02, 0x03]);
    }

    #[test]
    fn event_type_constants_are_stable() {
        // These strings are persisted in DB — never change them.
        assert_eq!(EVENT_OAUTH_TOKENS_ACQUIRED, "oauth.tokens.acquired");
        assert_eq!(EVENT_OAUTH_TOKEN_INVALIDATED, "oauth.tokens.invalidated");
    }
}
