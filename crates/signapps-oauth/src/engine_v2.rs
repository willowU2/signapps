//! OAuth2 + OIDC engine v2 — the core state machine.

use crate::catalog::Catalog;
use crate::config_store::ConfigStore;
use crate::error::OAuthError;
use crate::pkce;
use crate::protocol::Protocol;
use crate::scope::ScopeResolver;
use crate::state::FlowState;
use crate::types::{
    CallbackRequest, CallbackResponse, ResolvedCredentials, StartRequest, StartResponse,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use std::sync::Arc;
use tracing::instrument;
use url::Url;

/// Configuration for [`EngineV2`]. Built once at service boot.
#[derive(Clone)]
pub struct EngineV2Config {
    /// Catalog of providers (loaded from catalog.json).
    pub catalog: Arc<Catalog>,
    /// Tenant-aware config store.
    pub configs: Arc<dyn ConfigStore>,
    /// HMAC secret for signing FlowState.
    pub state_secret: Vec<u8>,
    /// Base URL for callback construction (e.g., "https://signapps.acme.com").
    pub callback_base_url: String,
}

/// OAuth2 + OIDC engine.
#[derive(Clone)]
pub struct EngineV2 {
    config: EngineV2Config,
}

impl EngineV2 {
    /// Build a new engine.
    #[must_use]
    pub fn new(config: EngineV2Config) -> Self {
        Self { config }
    }

    /// Step 1 of the OAuth flow — build the authorization URL.
    ///
    /// `creds` must be pre-resolved (decrypted) by the caller before invoking
    /// this method. The HTTP handler decrypts credentials via the keystore and
    /// passes them here, keeping the engine keystore-agnostic.
    ///
    /// # Errors
    ///
    /// - [`OAuthError::Catalog`] if the provider key is not found.
    /// - [`OAuthError::ProviderNotConfigured`] if no tenant config exists.
    /// - [`OAuthError::ProviderDisabled`] if the config is disabled.
    /// - [`OAuthError::PurposeNotAllowed`] if the purpose is not in the allowed list.
    /// - [`OAuthError::ScopeNotAllowed`] if a requested scope is not in allowed_scopes.
    /// - [`OAuthError::ProviderError`] if the catalog has a malformed authorize_url.
    #[instrument(skip(self, creds), fields(provider = %req.provider_key, tenant = %req.tenant_id))]
    pub async fn start(
        &self,
        req: StartRequest,
        creds: ResolvedCredentials,
    ) -> Result<StartResponse, OAuthError> {
        // 1. Resolve provider definition from the embedded catalog.
        let provider = self.config.catalog.get(&req.provider_key)?;

        // 2. Load tenant config + check enabled.
        let cfg = self
            .config
            .configs
            .get(req.tenant_id, &req.provider_key)
            .await?
            .ok_or(OAuthError::ProviderNotConfigured)?;
        if !cfg.enabled {
            return Err(OAuthError::ProviderDisabled);
        }

        // 3. Check purpose (login / integration).
        ScopeResolver::check_purpose_allowed(&cfg, req.purpose)?;

        // 4. Resolve scopes — use provider defaults if none requested,
        //    then filter against allowed_scopes.
        let scopes = if req.requested_scopes.is_empty() {
            provider.default_scopes.clone()
        } else {
            ScopeResolver::filter_scopes(&req.requested_scopes, &cfg)?
        };

        // 5. Generate PKCE if required by the provider.
        let (pkce_verifier, pkce_challenge) = if provider.pkce_required {
            let v = pkce::generate_verifier();
            let c = pkce::challenge_s256(&v);
            (Some(v), Some(c))
        } else {
            (None, None)
        };

        // 6. Build the FlowState.
        let nonce = generate_nonce();
        let mut flow = FlowState::new(
            req.tenant_id,
            req.provider_key.clone(),
            req.purpose,
            nonce.clone(),
        );
        flow.user_id = req.user_id;
        flow.redirect_after = req.redirect_after.clone();
        flow.pkce_verifier = pkce_verifier;
        flow.requested_scopes = scopes.clone();
        flow.override_client_id = req.override_client_id;
        let state_param = flow.sign(&self.config.state_secret);

        // 7. Expand template variables in the authorize_url (e.g., keycloak's
        //    {base_url} and {realm} come from creds.extra_params).
        let raw_url = provider.template_vars.iter().fold(
            provider.authorize_url.clone(),
            |url, var| {
                if let Some(val) = creds.extra_params.get(var.as_str()) {
                    url.replace(&format!("{{{var}}}"), val)
                } else {
                    url
                }
            },
        );

        // 8. Build the authorization URL using the pre-resolved client_id.
        let mut authorize_url = Url::parse(&raw_url).map_err(|_| OAuthError::ProviderError {
            error: "bad_authorize_url".into(),
            description: Some(format!(
                "provider {:?} authorize_url is malformed (after template expansion: {raw_url:?})",
                req.provider_key
            )),
        })?;

        let callback = format!(
            "{}/api/v1/oauth/{}/callback",
            self.config.callback_base_url.trim_end_matches('/'),
            req.provider_key
        );

        authorize_url
            .query_pairs_mut()
            .append_pair("response_type", "code")
            .append_pair("client_id", &creds.client_id)
            .append_pair("redirect_uri", &callback)
            .append_pair("scope", &scopes.join(&provider.scope_delimiter))
            .append_pair("state", &state_param);

        if let Some(c) = pkce_challenge {
            authorize_url
                .query_pairs_mut()
                .append_pair("code_challenge", &c)
                .append_pair("code_challenge_method", "S256");
        }

        if matches!(provider.protocol, Protocol::Oidc) {
            authorize_url
                .query_pairs_mut()
                .append_pair("nonce", &nonce);
        }

        Ok(StartResponse {
            authorization_url: authorize_url.to_string(),
            flow_id: flow.flow_id,
        })
    }

    /// Step 2 — full callback handling. Implemented in Task 7.
    ///
    /// # Errors
    ///
    /// Not yet implemented — panics with a message until P3T7.
    #[instrument(skip(self), fields(state_len = cb.state.len()))]
    pub async fn callback(&self, cb: CallbackRequest) -> Result<CallbackResponse, OAuthError> {
        let _ = cb;
        unimplemented!("filled in P3T7")
    }
}

/// Generate a 32-byte URL-safe nonce for OIDC `nonce` and FlowState anti-CSRF.
fn generate_nonce() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}
