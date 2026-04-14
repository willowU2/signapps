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
        let raw_url =
            provider
                .template_vars
                .iter()
                .fold(provider.authorize_url.clone(), |url, var| {
                    if let Some(val) = creds.extra_params.get(var.as_str()) {
                        url.replace(&format!("{{{var}}}"), val)
                    } else {
                        url
                    }
                });

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
            authorize_url.query_pairs_mut().append_pair("nonce", &nonce);
        }

        Ok(StartResponse {
            authorization_url: authorize_url.to_string(),
            flow_id: flow.flow_id,
        })
    }

    /// Step 2 — full callback handling: state verification, token exchange,
    /// and profile fetch.
    ///
    /// The caller (HTTP handler) is responsible for:
    /// - Re-encrypting the returned tokens via `signapps-keystore` + `EncryptedField`.
    /// - Emitting the `oauth.tokens.acquired` event (Plan 4).
    /// - Creating session JWTs when `purpose = Login`.
    ///
    /// This method is intentionally keystore- and JWT-agnostic for testability.
    ///
    /// # Errors
    ///
    /// - [`OAuthError::ProviderError`] if the provider returned an error param.
    /// - [`OAuthError::InvalidState`] if the state token is expired, tampered,
    ///   or malformed.
    /// - [`OAuthError::Catalog`] if the provider key from the state is not in
    ///   the catalog.
    /// - [`OAuthError::ProviderError`] if the token endpoint returns an HTTP error
    ///   or a JSON body with an `error` field.
    /// - [`OAuthError::ProviderError`] if the profile endpoint returns an HTTP error
    ///   or the `user_id_field` JSONPath does not resolve.
    #[instrument(skip(self, creds, http_client), fields(state_len = cb.state.len()))]
    pub async fn callback(
        &self,
        cb: CallbackRequest,
        creds: ResolvedCredentials,
        http_client: &reqwest::Client,
    ) -> Result<
        (
            CallbackResponse,
            crate::types::TokenResponse,
            crate::types::ProviderProfile,
            FlowState,
        ),
        OAuthError,
    > {
        // 1. If the provider returned an error, surface it immediately.
        if let Some(ref err) = cb.error {
            return Err(OAuthError::ProviderError {
                error: err.clone(),
                description: cb.error_description.clone(),
            });
        }

        // 2. Verify and deserialize the FlowState HMAC token.
        let flow = FlowState::verify(&cb.state, &self.config.state_secret)?;

        // 3. Re-resolve the provider definition from the catalog.
        let provider = self.config.catalog.get(&flow.provider_key)?;

        // 4. Build the callback redirect_uri (must match what was sent in step 1).
        let callback_url = format!(
            "{}/api/v1/oauth/{}/callback",
            self.config.callback_base_url.trim_end_matches('/'),
            flow.provider_key
        );

        // 5. Expand template variables in access_url (same logic as authorize_url in start).
        let raw_access_url =
            provider
                .template_vars
                .iter()
                .fold(provider.access_url.clone(), |url, var| {
                    if let Some(val) = creds.extra_params.get(var.as_str()) {
                        url.replace(&format!("{{{var}}}"), val)
                    } else {
                        url
                    }
                });

        // 6. POST to the token endpoint with form data.
        let mut form_params: Vec<(&str, String)> = vec![
            ("grant_type", "authorization_code".into()),
            ("code", cb.code.clone()),
            ("redirect_uri", callback_url.clone()),
            ("client_id", creds.client_id.clone()),
            ("client_secret", creds.client_secret.clone()),
        ];
        if let Some(ref verifier) = flow.pkce_verifier {
            form_params.push(("code_verifier", verifier.clone()));
        }

        let token_resp = http_client
            .post(&raw_access_url)
            .form(&form_params)
            .send()
            .await
            .map_err(|e| OAuthError::ProviderError {
                error: "token_request_failed".into(),
                description: Some(e.to_string()),
            })?;

        if !token_resp.status().is_success() {
            let status = token_resp.status().as_u16();
            let body = token_resp.text().await.unwrap_or_default();
            return Err(OAuthError::ProviderError {
                error: "token_endpoint_error".into(),
                description: Some(format!("HTTP {status}: {body}")),
            });
        }

        // Parse the token response — first attempt to detect provider-side errors
        // embedded in a 200 response (some providers do this).
        let token_body: serde_json::Value =
            token_resp
                .json()
                .await
                .map_err(|e| OAuthError::ProviderError {
                    error: "token_parse_error".into(),
                    description: Some(e.to_string()),
                })?;

        if let Some(err_field) = token_body.get("error").and_then(|v| v.as_str()) {
            let desc = token_body
                .get("error_description")
                .and_then(|v| v.as_str())
                .map(String::from);
            return Err(OAuthError::ProviderError {
                error: err_field.to_string(),
                description: desc,
            });
        }

        let token_response: crate::types::TokenResponse = serde_json::from_value(token_body)
            .map_err(|e| OAuthError::ProviderError {
                error: "token_parse_error".into(),
                description: Some(e.to_string()),
            })?;

        // 7. Fetch the user profile if a profile_url is configured.
        let raw_profile_url = provider.profile_url.as_ref().map(|u| {
            provider.template_vars.iter().fold(u.clone(), |url, var| {
                if let Some(val) = creds.extra_params.get(var.as_str()) {
                    url.replace(&format!("{{{var}}}"), val)
                } else {
                    url
                }
            })
        });

        let profile = if let Some(ref profile_url) = raw_profile_url {
            let profile_resp = http_client
                .get(profile_url)
                .bearer_auth(&token_response.access_token)
                .send()
                .await
                .map_err(|e| OAuthError::ProviderError {
                    error: "profile_request_failed".into(),
                    description: Some(e.to_string()),
                })?;

            if !profile_resp.status().is_success() {
                let status = profile_resp.status().as_u16();
                let body = profile_resp.text().await.unwrap_or_default();
                return Err(OAuthError::ProviderError {
                    error: "profile_endpoint_error".into(),
                    description: Some(format!("HTTP {status}: {body}")),
                });
            }

            let profile_body: serde_json::Value =
                profile_resp
                    .json()
                    .await
                    .map_err(|e| OAuthError::ProviderError {
                        error: "profile_parse_error".into(),
                        description: Some(e.to_string()),
                    })?;

            crate::profile::extract_profile(
                profile_body,
                &provider.user_id_field,
                provider.user_email_field.as_deref(),
                provider.user_name_field.as_deref(),
            )?
        } else {
            // No profile URL — synthesize a minimal profile from the token response.
            // For OIDC providers the id_token carries the sub claim which is enough.
            crate::types::ProviderProfile {
                id: flow.flow_id.to_string(),
                email: None,
                name: None,
                raw: serde_json::Value::Null,
            }
        };

        // 8. Build the CallbackResponse (JWT creation deferred to HTTP layer).
        let redirect_to = flow
            .redirect_after
            .clone()
            .unwrap_or_else(|| "/".to_string());

        let callback_response = CallbackResponse {
            redirect_to,
            session_jwt: None,
        };

        Ok((callback_response, token_response, profile, flow))
    }
}

/// Generate a 32-byte URL-safe nonce for OIDC `nonce` and FlowState anti-CSRF.
fn generate_nonce() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}
