//! Integration tests for EngineV2::callback.
//!
//! Tests that fail before HTTP (provider error, invalid state) need no wiremock
//! server — the engine short-circuits before any network call.
//! Full token-exchange wiremock tests are deferred to P3T11 + Plan 4 E2E tests.

use signapps_oauth::{
    CallbackRequest, Catalog, ConfigStore, EngineV2, EngineV2Config, FlowState, OAuthError,
    OAuthPurpose, ProviderConfig, ResolvedCredentials,
};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

/// Minimal mock ConfigStore that returns a fixed ProviderConfig.
struct MockConfigStore {
    config: Option<ProviderConfig>,
}

#[async_trait::async_trait]
impl ConfigStore for MockConfigStore {
    async fn get(
        &self,
        _tenant_id: Uuid,
        _provider_key: &str,
    ) -> Result<Option<ProviderConfig>, OAuthError> {
        Ok(self.config.clone())
    }

    async fn list_for_tenant(&self, _tenant_id: Uuid) -> Result<Vec<ProviderConfig>, OAuthError> {
        Ok(self.config.clone().into_iter().collect())
    }
}

const STATE_SECRET: &[u8] = b"0123456789abcdef0123456789abcdef";

fn mk_engine() -> EngineV2 {
    let config = Some(ProviderConfig {
        id: Uuid::new_v4(),
        tenant_id: Uuid::new_v4(),
        provider_key: "google".into(),
        client_id_enc: None,
        client_secret_enc: None,
        extra_params_enc: None,
        enabled: true,
        purposes: vec!["login".into()],
        allowed_scopes: vec!["openid".into(), "email".into()],
        visibility: "all".into(),
        visible_to_org_nodes: vec![],
        visible_to_groups: vec![],
        visible_to_roles: vec![],
        visible_to_users: vec![],
        allow_user_override: false,
        is_tenant_sso: false,
        auto_provision_users: false,
        default_role: None,
    });

    let catalog = Arc::new(Catalog::load_embedded().unwrap());
    EngineV2::new(EngineV2Config {
        catalog,
        configs: Arc::new(MockConfigStore { config }),
        state_secret: STATE_SECRET.to_vec(),
        callback_base_url: "https://signapps.test".into(),
    })
}

fn mk_creds() -> ResolvedCredentials {
    ResolvedCredentials {
        client_id: "test-client-id".into(),
        client_secret: "test-client-secret".into(),
        extra_params: HashMap::new(),
        override_id: None,
    }
}

/// Build a valid signed state for the "google" provider.
fn mk_valid_state() -> String {
    let flow = FlowState::new(
        Uuid::new_v4(),
        "google".into(),
        OAuthPurpose::Login,
        "testnonce".into(),
    );
    flow.sign(STATE_SECRET)
}

/// The callback must surface OAuthError::ProviderError when the provider
/// returns an error query param (e.g., `?error=access_denied`).
///
/// No HTTP call is made — the engine short-circuits before token exchange.
#[tokio::test]
async fn callback_rejects_provider_error() {
    let engine = mk_engine();
    let http = reqwest::Client::new();

    let cb = CallbackRequest {
        code: "any_code".into(),
        state: mk_valid_state(),
        error: Some("access_denied".into()),
        error_description: Some("User denied access".into()),
    };

    let err = engine
        .callback(cb, mk_creds(), &http)
        .await
        .expect_err("should fail with ProviderError");

    assert!(
        matches!(
            err,
            OAuthError::ProviderError { ref error, .. } if error == "access_denied"
        ),
        "expected ProviderError(access_denied), got: {err:?}"
    );
}

/// The callback must surface OAuthError::InvalidState when the state token
/// is not validly HMAC-signed.
///
/// No HTTP call is made — state verification fails before token exchange.
#[tokio::test]
async fn callback_rejects_invalid_state() {
    let engine = mk_engine();
    let http = reqwest::Client::new();

    let cb = CallbackRequest {
        code: "any_code".into(),
        state: "totally.invalid_state_token".into(),
        error: None,
        error_description: None,
    };

    let err = engine
        .callback(cb, mk_creds(), &http)
        .await
        .expect_err("should fail with InvalidState");

    assert!(
        matches!(err, OAuthError::InvalidState(_)),
        "expected InvalidState, got: {err:?}"
    );
}
