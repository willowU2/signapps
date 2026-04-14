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

pub mod error;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::Error as AppError;
use signapps_oauth::{OAuthPurpose, ProviderSummary};
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
/// # Errors
///
/// Returns 503 until P3T10 wires in the credential resolver.
/// After P3T10:
/// - [`AppError::BadRequest`] — provider not configured / scope not allowed.
/// - [`AppError::Forbidden`] — purpose not allowed / user access denied.
/// - [`AppError::NotFound`] — provider key not in catalog.
/// - [`AppError::ExternalService`] — provider returned an error.
///
/// # Panics
///
/// No panics — all errors propagate via `Result`.
#[instrument(skip(_state, body), fields(provider = %provider, tenant = ?body.tenant_id))]
pub async fn start_flow(
    State(_state): State<AppState>,
    Path(provider): Path<String>,
    Json(body): Json<StartFlowBody>,
) -> Result<impl IntoResponse, AppError> {
    tracing::warn!(
        provider = %provider,
        tenant_id = %body.tenant_id,
        "start_flow called — credential resolver not yet wired (P3T10 pending)"
    );

    // P3T9 scaffold: return 503 with RFC 7807-like detail.
    // P3T10 will:
    //  1. Fetch ProviderConfig from state.oauth_engine_state.configs.get(tenant_id, &provider).
    //  2. Decrypt client_id_enc / client_secret_enc via state.keystore.
    //  3. Build ResolvedCredentials.
    //  4. Call state.oauth_engine_state.engine.start(req, creds).await.
    //  5. Return Json(StartResponse) or map OAuthError via oauth_error_to_app_error.
    let body = serde_json::json!({
        "type": "urn:signapps:error:service_unavailable",
        "title": "Service Unavailable",
        "status": 503,
        "detail": "OAuth credential resolver is not yet wired (P3T10 pending). \
                   The engine is functional but HTTP handlers need keystore \
                   integration before they can issue real authorization URLs.",
        "error_code": "OAUTH_NOT_WIRED"
    });

    Ok((StatusCode::SERVICE_UNAVAILABLE, Json(body)))
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
/// # Errors
///
/// Returns 503 until P3T10 wires in the credential resolver.
/// After P3T10:
/// - [`AppError::Unauthorized`] — invalid/expired state token.
/// - [`AppError::ExternalService`] — provider returned an error or token
///   exchange failed.
/// - Redirects to `flow.redirect_after` on success.
///
/// # Panics
///
/// No panics — all errors propagate via `Result`.
#[instrument(skip(_state, query), fields(provider = %provider))]
pub async fn callback(
    State(_state): State<AppState>,
    Path(provider): Path<String>,
    Query(query): Query<CallbackQuery>,
) -> Result<impl IntoResponse, AppError> {
    // If the provider returned an error, surface it immediately even in scaffold mode.
    if let Some(ref err) = query.error {
        let description = query
            .error_description
            .as_deref()
            .unwrap_or("no description");
        tracing::warn!(
            provider = %provider,
            error = %err,
            description = %description,
            "OAuth provider returned error on callback"
        );
        return Err(AppError::ExternalService(format!(
            "oauth:{provider}: provider returned error '{err}': {description}"
        )));
    }

    tracing::warn!(
        provider = %provider,
        "callback called — credential resolver not yet wired (P3T10 pending)"
    );

    // P3T9 scaffold: return 503.
    // P3T10 will:
    //  1. Verify the `state` param is present (else 400).
    //  2. Decrypt FlowState to recover tenant_id + provider_key.
    //  3. Fetch ProviderConfig + decrypt credentials via state.keystore.
    //  4. Build ResolvedCredentials.
    //  5. Call state.oauth_engine_state.engine.callback(cb, creds, &http_client).await.
    //  6. Re-encrypt tokens via state.keystore + persist to oauth_tokens table (Plan 4).
    //  7. Emit oauth.tokens.acquired event on PgEventBus (Plan 4).
    //  8. Build session JWT if purpose == Login.
    //  9. Redirect to CallbackResponse.redirect_to.
    let body = serde_json::json!({
        "type": "urn:signapps:error:service_unavailable",
        "title": "Service Unavailable",
        "status": 503,
        "detail": "OAuth credential resolver is not yet wired (P3T10 pending). \
                   The callback route is registered and reachable, but token \
                   exchange requires keystore integration.",
        "error_code": "OAUTH_NOT_WIRED"
    });

    Ok((StatusCode::SERVICE_UNAVAILABLE, Json(body)))
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
