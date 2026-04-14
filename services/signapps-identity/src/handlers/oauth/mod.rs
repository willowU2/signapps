//! OAuth2/OIDC HTTP handlers for the Identity service.
//!
//! Exposes three endpoints:
//!
//! | Method | Path | Description |
//! |--------|------|-------------|
//! | `GET` | `/api/v1/oauth/providers` | List embedded catalog providers |
//! | `POST` | `/api/v1/oauth/{provider}/start` | Begin an OAuth flow |
//! | `GET` | `/api/v1/oauth/{provider}/callback` | Handle provider callback |
//!
//! ## Scaffold status (P3T9)
//!
//! `list_providers` is fully operational — it returns all catalog entries.
//!
//! `start_flow` and `callback` return **503 Service Unavailable** until
//! P3T10 wires in the credential resolver (keystore-backed decrypt of
//! `client_id_enc` / `client_secret_enc` from `oauth_provider_configs`).

pub mod creds;
pub mod error;

use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::Error as AppError;
use signapps_oauth::{OAuthError, OAuthPurpose, ProviderSummary, StartRequest};
use std::sync::Arc;
use tracing::instrument;
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// Shared engine state (attached to AppState in P3T9)
// ---------------------------------------------------------------------------

/// OAuth engine state shared across all OAuth handlers.
///
/// Constructed once at boot in `main.rs` and stored behind an `Arc` in
/// [`AppState`]. Fields are individually `Arc`-wrapped because they are also
/// shared with background tasks (token-refresh, event bus).
#[derive(Clone)]
pub struct OAuthEngineState {
    /// The running OAuth2/OIDC engine.
    pub engine: signapps_oauth::EngineV2,
    /// Embedded provider catalog (loaded at boot from `catalog.json`).
    pub catalog: Arc<signapps_oauth::Catalog>,
    /// Tenant-scoped provider config store.
    pub configs: Arc<dyn signapps_oauth::ConfigStore>,
    /// HMAC key for verifying FlowState tokens (anti-CSRF).
    /// Populated from `OAUTH_STATE_SECRET` at boot.
    pub state_secret: Vec<u8>,
}

// ---------------------------------------------------------------------------
// list_providers — GET /api/v1/oauth/providers
// ---------------------------------------------------------------------------

/// Summary of a provider as returned by the list endpoint.
///
/// Safe to expose over the API — no encrypted / sensitive fields.
#[derive(Debug, Serialize)]
pub struct ProviderListItem {
    /// Provider key (e.g., "google", "microsoft").
    pub key: String,
    /// Human-readable name.
    pub display_name: String,
    /// Categories (Mail, Calendar, Drive, Social, SSO, …).
    pub categories: Vec<signapps_oauth::ProviderCategory>,
    /// Always `false` for P3T9 — tenant-aware enable/disable is Plan 5.
    pub enabled: bool,
    /// Allowed purposes — empty for P3T9 (no tenant config consulted yet).
    pub purposes: Vec<String>,
    /// Always `true` for P3T9 — visibility filtering is Plan 5.
    pub visible: bool,
}

impl From<ProviderSummary> for ProviderListItem {
    fn from(s: ProviderSummary) -> Self {
        Self {
            key: s.key,
            display_name: s.display_name,
            categories: s.categories,
            enabled: s.enabled,
            purposes: s.purposes,
            visible: s.visible,
        }
    }
}

/// List all providers from the embedded catalog.
///
/// Returns a flat list of all catalog entries. The `enabled` field is always
/// `false` and `purposes` is always empty until Plan 5 wires in per-tenant
/// config resolution.
///
/// # Errors
///
/// Returns [`AppError::Internal`] if the engine state is not initialized
/// (this should never happen after a successful boot).
#[instrument(skip(state))]
pub async fn list_providers(
    State(state): State<AppState>,
) -> Result<Json<Vec<ProviderListItem>>, AppError> {
    let oauth = &state.oauth_engine_state;

    let items: Vec<ProviderListItem> = oauth
        .catalog
        .iter()
        .map(|(key, def)| ProviderListItem {
            key: key.to_string(),
            display_name: def.display_name.clone(),
            categories: def.categories.clone(),
            enabled: false,
            purposes: vec![],
            visible: true,
        })
        .collect();

    tracing::info!(count = items.len(), "OAuth catalog providers listed");
    Ok(Json(items))
}

// ---------------------------------------------------------------------------
// start_flow — POST /api/v1/oauth/{provider}/start
// ---------------------------------------------------------------------------

/// Request body for `POST /api/v1/oauth/{provider}/start`.
///
/// All fields are deserialized from the JSON request body. Fields other than
/// `tenant_id` and `purpose` are forwarded to `EngineV2::start` in P3T10.
#[derive(Debug, Deserialize)]
#[allow(dead_code)] // Fields consumed by P3T10 credential resolver.
pub struct StartFlowBody {
    /// Tenant initiating the flow.
    pub tenant_id: Uuid,
    /// User initiating the flow (`None` for login flows).
    pub user_id: Option<Uuid>,
    /// Why are we doing this (login or integration).
    pub purpose: OAuthPurpose,
    /// Where to send the browser after the callback completes.
    pub redirect_after: Option<String>,
    /// Extra scopes to request (empty = use provider defaults).
    #[serde(default)]
    pub requested_scopes: Vec<String>,
}

/// Initiate an OAuth authorization flow.
///
/// Loads the tenant's [`signapps_oauth::ProviderConfig`] from the config store,
/// decrypts credentials via the keystore, and delegates to [`EngineV2::start`]
/// which builds the full authorization URL (with PKCE, state, scope resolution).
///
/// # Errors
///
/// - [`AppError::BadRequest`] — provider not configured for this tenant, disabled,
///   requested scope not allowed, or required parameter missing.
/// - [`AppError::Forbidden`] — purpose not allowed or user access denied.
/// - [`AppError::NotFound`] — provider key not in catalog.
/// - [`AppError::Internal`] — crypto failure (DEK unavailable or decryption error).
/// - [`AppError::ExternalService`] — provider returned an error.
///
/// # Panics
///
/// No panics — all errors propagate via `Result`.
#[instrument(skip(state, body), fields(provider = %provider, tenant = ?body.tenant_id))]
pub async fn start_flow(
    State(state): State<AppState>,
    Path(provider): Path<String>,
    Json(body): Json<StartFlowBody>,
) -> Result<Json<signapps_oauth::StartResponse>, AppError> {
    // 1. Load tenant config from the config store.
    let cfg_opt = state
        .oauth_engine_state
        .configs
        .get(body.tenant_id, &provider)
        .await
        .map_err(error::oauth_error_to_app_error)?;
    let cfg = cfg_opt
        .ok_or_else(|| error::oauth_error_to_app_error(OAuthError::ProviderNotConfigured))?;

    // 2. Decrypt credentials via keystore.
    let resolved_creds = creds::resolve_credentials(&cfg, &state.keystore)
        .map_err(error::oauth_error_to_app_error)?;

    // 3. Build the StartRequest for the engine.
    let req = StartRequest {
        tenant_id: body.tenant_id,
        provider_key: provider.clone(),
        user_id: body.user_id,
        purpose: body.purpose,
        redirect_after: body.redirect_after,
        requested_scopes: body.requested_scopes,
        override_client_id: None,
    };

    // 4. Delegate to the engine — builds auth URL, signs FlowState, etc.
    let resp = state
        .oauth_engine_state
        .engine
        .start(req, resolved_creds)
        .await
        .map_err(error::oauth_error_to_app_error)?;

    tracing::info!(
        provider = %provider,
        tenant_id = %body.tenant_id,
        flow_id = %resp.flow_id,
        "OAuth start_flow succeeded — authorization URL built"
    );

    Ok(Json(resp))
}

// ---------------------------------------------------------------------------
// callback — GET /api/v1/oauth/{provider}/callback
// ---------------------------------------------------------------------------

/// Query parameters received from the OAuth provider on callback.
#[derive(Debug, Deserialize)]
pub struct CallbackQuery {
    /// Authorization code from the provider.
    /// Consumed by P3T10 credential resolver.
    #[allow(dead_code)]
    pub code: Option<String>,
    /// HMAC-signed FlowState token.
    /// Verified by P3T10 via `FlowState::verify`.
    #[allow(dead_code)]
    pub state: Option<String>,
    /// Provider-returned error code (RFC 6749 §4.1.2.1).
    pub error: Option<String>,
    /// Human-readable error description.
    pub error_description: Option<String>,
}

/// Handle the OAuth provider callback (redirect URI).
///
/// Full pipeline (Plan 4 / P4T8):
/// 1. If the provider returned an error, surface it immediately.
/// 2. Verify the HMAC-signed `state` token to extract `tenant_id` and `purpose`.
/// 3. Load the tenant's `ProviderConfig` and decrypt credentials via the keystore.
/// 4. Call `EngineV2::callback` — token exchange + profile fetch.
/// 5. Encrypt `access_token` and `refresh_token` with DEK `oauth-tokens-v1`.
/// 6. Resolve the provider's primary category from the catalog.
/// 7. Publish `oauth.tokens.acquired` via `PgEventBus`.
/// 8. Redirect — for `Login` flows, appends `provider` + `email` to the redirect URL
///    so the frontend can finalize the session.  Full JWT issuance is a follow-up task.
///
/// # Errors
///
/// - [`AppError::BadRequest`] — `state` query param missing or provider not configured.
/// - [`AppError::Unauthorized`] — state token expired, tampered, or malformed.
/// - [`AppError::ExternalService`] — provider returned an error or token exchange failed.
/// - [`AppError::Internal`] — crypto failure or event-bus publish error.
///
/// # Panics
///
/// No panics — all errors propagate via `Result`.
#[instrument(skip(state, query), fields(provider = %provider_key))]
pub async fn callback(
    State(state): State<AppState>,
    Path(provider_key): Path<String>,
    Query(query): Query<CallbackQuery>,
) -> Result<axum::response::Redirect, AppError> {
    use signapps_common::crypto::EncryptedField;
    use signapps_common::pg_events::NewEvent;
    use signapps_oauth::{
        CallbackRequest, FlowState, OAuthTokensAcquired, EVENT_OAUTH_TOKENS_ACQUIRED,
    };

    // 1. If the provider returned an error, surface it immediately.
    if let Some(ref err) = query.error {
        let description = query
            .error_description
            .as_deref()
            .unwrap_or("no description");
        tracing::warn!(
            provider = %provider_key,
            error = %err,
            description = %description,
            "OAuth provider returned error on callback"
        );
        return Err(AppError::ExternalService(format!(
            "oauth:{provider_key}: provider returned error '{err}': {description}"
        )));
    }

    // 2. Verify the state token to extract tenant_id and purpose.
    //    state is required — missing means a malformed redirect.
    let state_token = query
        .state
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("oauth: missing `state` query parameter".into()))?;
    let flow_preview = FlowState::verify(state_token, &state.oauth_engine_state.state_secret)
        .map_err(|e| error::oauth_error_to_app_error(OAuthError::InvalidState(e)))?;
    let tenant_id = flow_preview.tenant_id;
    let purpose = flow_preview.purpose;

    // 3. Load tenant ProviderConfig + decrypt credentials.
    let cfg = state
        .oauth_engine_state
        .configs
        .get(tenant_id, &provider_key)
        .await
        .map_err(error::oauth_error_to_app_error)?
        .ok_or_else(|| error::oauth_error_to_app_error(OAuthError::ProviderNotConfigured))?;
    let creds = creds::resolve_credentials(&cfg, &state.keystore)
        .map_err(error::oauth_error_to_app_error)?;

    // 4. Build CallbackRequest and call EngineV2::callback.
    let cb_req = CallbackRequest {
        code: query.code.clone().unwrap_or_default(),
        state: state_token.to_string(),
        error: query.error.clone(),
        error_description: query.error_description.clone(),
    };
    let http = reqwest::Client::new();
    let (cb_resp, tokens, profile, flow) = state
        .oauth_engine_state
        .engine
        .callback(cb_req, creds, &http)
        .await
        .map_err(error::oauth_error_to_app_error)?;

    // 5. Encrypt tokens with DEK 'oauth-tokens-v1'.
    let dek = state.keystore.dek("oauth-tokens-v1");
    let access_token_enc = <()>::encrypt(tokens.access_token.as_bytes(), &dek)
        .map_err(|e| AppError::Internal(format!("encrypt access_token: {e}")))?;
    let refresh_token_enc = tokens
        .refresh_token
        .as_ref()
        .map(|rt| <()>::encrypt(rt.as_bytes(), &dek))
        .transpose()
        .map_err(|e| AppError::Internal(format!("encrypt refresh_token: {e}")))?;
    let expires_at = tokens
        .expires_in
        .map(|s| chrono::Utc::now() + chrono::Duration::seconds(s));

    // 6. Resolve the provider's primary category from the catalog.
    let provider_def = state
        .oauth_engine_state
        .catalog
        .get(&provider_key)
        .map_err(|_| AppError::Internal("provider vanished from catalog after callback".into()))?;
    let category = provider_def
        .categories
        .first()
        .copied()
        .unwrap_or(signapps_oauth::ProviderCategory::Other);

    // 7. Publish oauth.tokens.acquired event.
    let event = OAuthTokensAcquired {
        user_id: flow.user_id,
        tenant_id,
        provider_key: provider_key.clone(),
        purpose,
        category,
        access_token_enc,
        refresh_token_enc,
        expires_at,
        scopes_granted: tokens
            .scope
            .as_deref()
            .map(|s| s.split(' ').map(String::from).collect())
            .unwrap_or_default(),
        provider_user_id: profile.id.clone(),
        provider_user_email: profile.email.clone(),
    };
    let payload = serde_json::to_value(&event)
        .map_err(|e| AppError::Internal(format!("serialize oauth event: {e}")))?;
    state
        .event_bus
        .publish(NewEvent {
            event_type: EVENT_OAUTH_TOKENS_ACQUIRED.to_string(),
            aggregate_id: flow.user_id,
            payload,
        })
        .await
        .map_err(|e| AppError::Internal(format!("publish oauth.tokens.acquired: {e}")))?;

    tracing::info!(
        provider = %provider_key,
        tenant_id = %tenant_id,
        purpose = ?purpose,
        provider_user_id = %profile.id,
        "OAuth callback completed — tokens encrypted and event published"
    );

    // 8. Build redirect URL.
    //    For Login flows, append provider + email so the frontend can finalize the session.
    //    Full JWT issuance (user provision → create_jwt) is a follow-up task.
    let redirect_to = if matches!(purpose, OAuthPurpose::Login) {
        format!(
            "{}?provider={}&email={}",
            cb_resp.redirect_to,
            urlencoding::encode(&provider_key),
            urlencoding::encode(profile.email.as_deref().unwrap_or(""))
        )
    } else {
        cb_resp.redirect_to
    };

    Ok(axum::response::Redirect::to(&redirect_to))
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        let _ = module_path!();
    }
}
