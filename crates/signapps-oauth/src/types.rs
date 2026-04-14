//! Request and response types for the OAuth engine.

use crate::protocol::OAuthPurpose;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Input to `EngineV2::start`.
#[derive(Debug, Clone, Deserialize)]
pub struct StartRequest {
    /// Tenant scope.
    pub tenant_id: Uuid,
    /// Provider key (matches catalog or oauth_providers row).
    pub provider_key: String,
    /// User initiating the flow (None for Login flows).
    pub user_id: Option<Uuid>,
    /// Why are we doing this (Login or Integration).
    pub purpose: OAuthPurpose,
    /// Where to redirect after the callback completes.
    pub redirect_after: Option<String>,
    /// Specific scopes to request. If empty, the engine uses the
    /// provider's `default_scopes`.
    #[serde(default)]
    pub requested_scopes: Vec<String>,
    /// User's personal credentials override (if oauth_user_overrides exists).
    pub override_client_id: Option<Uuid>,
}

/// Output of `EngineV2::start`.
#[derive(Debug, Clone, Serialize)]
pub struct StartResponse {
    /// Where to redirect the user (the provider's authorization URL with
    /// all necessary params: response_type, client_id, scope, state,
    /// code_challenge, etc).
    pub authorization_url: String,
    /// Internal flow ID — the same ID is in the FlowState payload.
    /// Useful for log correlation.
    pub flow_id: Uuid,
}

/// Input to `EngineV2::callback` — the query params returned by the provider.
#[derive(Debug, Clone, Deserialize)]
pub struct CallbackRequest {
    /// Authorization code returned by the provider.
    pub code: String,
    /// State parameter — must verify against our HMAC.
    pub state: String,
    /// If present, the provider returned an error instead of a code.
    #[serde(default)]
    pub error: Option<String>,
    /// Optional human-readable error description.
    #[serde(default)]
    pub error_description: Option<String>,
}

/// Output of `EngineV2::callback`.
#[derive(Debug, Clone, Serialize)]
pub struct CallbackResponse {
    /// Where to redirect the user (typically `redirect_after` from the
    /// FlowState, or `/` if not set).
    pub redirect_to: String,
    /// For `purpose = Login`, the JWT to set as a session cookie.
    /// `None` for `purpose = Integration` (no session change).
    pub session_jwt: Option<String>,
}

/// Provider's `/token` endpoint response (OAuth 2.0 + OIDC fields).
#[derive(Debug, Clone, Deserialize)]
pub struct TokenResponse {
    /// Access token (the bearer for downstream API calls).
    pub access_token: String,
    /// Optional refresh token (long-lived, used to refresh access_token).
    #[serde(default)]
    pub refresh_token: Option<String>,
    /// Number of seconds until access_token expires.
    #[serde(default)]
    pub expires_in: Option<i64>,
    /// Granted scopes (space-separated, can be subset of requested).
    #[serde(default)]
    pub scope: Option<String>,
    /// Token type (usually "Bearer").
    #[serde(default)]
    pub token_type: Option<String>,
    /// OIDC id_token (signed JWT with user claims).
    #[serde(default)]
    pub id_token: Option<String>,
}

/// Profile fetched from the provider's userinfo endpoint, narrowed
/// down to the fields we use.
#[derive(Debug, Clone)]
pub struct ProviderProfile {
    /// Provider-side user ID (from `user_id_field` JSONPath).
    pub id: String,
    /// Optional email.
    pub email: Option<String>,
    /// Optional display name.
    pub name: Option<String>,
    /// Raw JSON body for downstream consumers that want more fields.
    pub raw: serde_json::Value,
}

/// Resolved provider credentials (decrypted just-in-time).
#[derive(Debug, Clone)]
pub struct ResolvedCredentials {
    /// OAuth client ID (decrypted from the encrypted column).
    pub client_id: String,
    /// OAuth client secret (decrypted).
    pub client_secret: String,
    /// Optional extra params (Apple key, SAML cert) decoded from JSON.
    pub extra_params: HashMap<String, String>,
    /// If using oauth_user_overrides, the row ID for FlowState.
    pub override_id: Option<Uuid>,
}
