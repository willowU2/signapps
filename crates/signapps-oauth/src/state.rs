//! Stateless HMAC-signed FlowState for OAuth callbacks.

use crate::protocol::OAuthPurpose;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

/// Default lifetime of a FlowState token (10 minutes).
pub const FLOW_STATE_TTL_SECONDS: i64 = 600;

/// Errors from state signing/verification.
#[derive(Debug, Error)]
pub enum StateError {
    /// State token is malformed (missing separator, invalid base64, etc).
    #[error("malformed state token")]
    Malformed,
    /// HMAC signature does not verify.
    #[error("bad signature")]
    BadSignature,
    /// State has expired past its `expires_at` timestamp.
    #[error("state expired")]
    Expired,
    /// JSON deserialization of the payload failed.
    #[error("invalid state payload: {0}")]
    InvalidPayload(#[from] serde_json::Error),
}

/// The payload carried in the OAuth `state` query parameter.
///
/// Stateless design: the state machine keeps no server-side session.
/// All flow context rides in this struct, which is JSON-serialized,
/// then HMAC-signed via [`FlowState::sign`] and base64url-encoded.
/// The signed form is passed to the provider as the `state` param and
/// returned verbatim in the callback URL.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowState {
    /// Unique ID for this flow (logging, debug, analytics).
    pub flow_id: Uuid,
    /// The user initiating the flow (None for Login purpose — no session yet).
    pub user_id: Option<Uuid>,
    /// Tenant this flow belongs to.
    pub tenant_id: Uuid,
    /// Provider key (matches catalog.json entry or oauth_providers.key).
    pub provider_key: String,
    /// Login (SSO) or Integration (mail/calendar/drive/social).
    pub purpose: OAuthPurpose,
    /// Where to redirect the user after the flow completes.
    pub redirect_after: Option<String>,
    /// PKCE code verifier (if the provider requires PKCE).
    pub pkce_verifier: Option<String>,
    /// Anti-CSRF nonce — 32 random bytes base64-encoded.
    pub nonce: String,
    /// Unix timestamp (seconds) when the state was signed.
    pub issued_at: i64,
    /// Unix timestamp (seconds) after which the state is rejected.
    pub expires_at: i64,
    /// Scopes the caller requested.
    pub requested_scopes: Vec<String>,
    /// If the user supplied their own client_id/secret via oauth_user_overrides.
    pub override_client_id: Option<Uuid>,
}

impl FlowState {
    /// Build a fresh FlowState, setting issued_at and expires_at to
    /// now and now+TTL respectively.
    ///
    /// The caller is responsible for supplying the rest of the fields.
    #[must_use]
    pub fn new(
        tenant_id: Uuid,
        provider_key: String,
        purpose: OAuthPurpose,
        nonce: String,
    ) -> Self {
        let now = Utc::now().timestamp();
        Self {
            flow_id: Uuid::new_v4(),
            user_id: None,
            tenant_id,
            provider_key,
            purpose,
            redirect_after: None,
            pkce_verifier: None,
            nonce,
            issued_at: now,
            expires_at: now + FLOW_STATE_TTL_SECONDS,
            requested_scopes: Vec::new(),
            override_client_id: None,
        }
    }

    /// True if the state has already expired at the current time.
    #[must_use]
    pub fn is_expired(&self) -> bool {
        Utc::now().timestamp() > self.expires_at
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_sets_issued_and_expires() {
        let s = FlowState::new(
            Uuid::new_v4(),
            "google".to_string(),
            OAuthPurpose::Login,
            "nonce123".to_string(),
        );
        assert!(s.expires_at > s.issued_at);
        assert_eq!(s.expires_at - s.issued_at, FLOW_STATE_TTL_SECONDS);
        assert_eq!(s.purpose, OAuthPurpose::Login);
        assert!(!s.is_expired(), "fresh state should not be expired");
    }

    #[test]
    fn manually_expired_state_detected() {
        let mut s = FlowState::new(
            Uuid::new_v4(),
            "x".into(),
            OAuthPurpose::Login,
            "n".into(),
        );
        s.expires_at = 0; // in the past
        assert!(s.is_expired());
    }

    #[test]
    fn serde_roundtrips() {
        let s = FlowState::new(
            Uuid::new_v4(),
            "microsoft".into(),
            OAuthPurpose::Integration,
            "nonceABCDEF".into(),
        );
        let json = serde_json::to_string(&s).unwrap();
        let back: FlowState = serde_json::from_str(&json).unwrap();
        assert_eq!(back.flow_id, s.flow_id);
        assert_eq!(back.provider_key, s.provider_key);
        assert_eq!(back.purpose, s.purpose);
    }
}
