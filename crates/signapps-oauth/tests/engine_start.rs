//! Integration tests for EngineV2::start (URL building + state signing).

use signapps_oauth::{
    Catalog, ConfigStore, EngineV2, EngineV2Config, OAuthError, OAuthPurpose, ProviderConfig,
    ResolvedCredentials, StartRequest,
};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

/// Mock ConfigStore for tests — returns a hardcoded ProviderConfig.
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

    async fn list_for_tenant(
        &self,
        _tenant_id: Uuid,
    ) -> Result<Vec<ProviderConfig>, OAuthError> {
        Ok(self.config.clone().into_iter().collect())
    }
}

fn mk_engine(
    provider_key: &str,
    enabled: bool,
    purposes: Vec<&str>,
    scopes: Vec<&str>,
) -> EngineV2 {
    let config = if enabled {
        Some(ProviderConfig {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            provider_key: provider_key.into(),
            client_id_enc: None,
            client_secret_enc: None,
            extra_params_enc: None,
            enabled,
            purposes: purposes.into_iter().map(String::from).collect(),
            allowed_scopes: scopes.into_iter().map(String::from).collect(),
            visibility: "all".into(),
            visible_to_org_nodes: vec![],
            visible_to_groups: vec![],
            visible_to_roles: vec![],
            visible_to_users: vec![],
            allow_user_override: false,
            is_tenant_sso: false,
            auto_provision_users: false,
            default_role: None,
        })
    } else {
        None
    };
    let catalog = Arc::new(Catalog::load_embedded().unwrap());
    EngineV2::new(EngineV2Config {
        catalog,
        configs: Arc::new(MockConfigStore { config }),
        state_secret: b"0123456789abcdef0123456789abcdef".to_vec(),
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

/// Credentials with keycloak template vars pre-populated.
fn mk_creds_keycloak() -> ResolvedCredentials {
    let mut extra = HashMap::new();
    extra.insert("base_url".to_string(), "https://keycloak.test".to_string());
    extra.insert("realm".to_string(), "myrealm".to_string());
    ResolvedCredentials {
        client_id: "test-client-id".into(),
        client_secret: "test-client-secret".into(),
        extra_params: extra,
        override_id: None,
    }
}

#[tokio::test]
async fn start_builds_google_url_with_pkce() {
    let engine = mk_engine("google", true, vec!["login"], vec!["openid", "email", "profile"]);
    let req = StartRequest {
        tenant_id: Uuid::new_v4(),
        provider_key: "google".into(),
        user_id: None,
        purpose: OAuthPurpose::Login,
        redirect_after: None,
        requested_scopes: vec![],
        override_client_id: None,
    };
    let resp = engine.start(req, mk_creds()).await.expect("start succeeds");
    assert!(
        resp.authorization_url
            .starts_with("https://accounts.google.com/o/oauth2/v2/auth"),
        "URL should point to Google authorize endpoint"
    );
    assert!(
        resp.authorization_url.contains("client_id=test-client-id"),
        "client_id should be in URL"
    );
    assert!(
        resp.authorization_url.contains("response_type=code"),
        "response_type=code should be in URL"
    );
    assert!(
        resp.authorization_url.contains("state="),
        "signed state should be in URL"
    );
    // Google has pkce_required=false in the catalog — no PKCE challenge.
    assert!(
        !resp.authorization_url.contains("code_challenge="),
        "Google should not include PKCE challenge"
    );
}

#[tokio::test]
async fn start_includes_pkce_for_gitlab() {
    let engine = mk_engine("gitlab", true, vec!["integration"], vec!["read_user"]);
    let req = StartRequest {
        tenant_id: Uuid::new_v4(),
        provider_key: "gitlab".into(),
        user_id: Some(Uuid::new_v4()),
        purpose: OAuthPurpose::Integration,
        redirect_after: None,
        requested_scopes: vec![],
        override_client_id: None,
    };
    let resp = engine.start(req, mk_creds()).await.expect("start");
    assert!(
        resp.authorization_url.contains("code_challenge="),
        "GitLab (pkce_required=true) should include code_challenge"
    );
    assert!(
        resp.authorization_url.contains("code_challenge_method=S256"),
        "PKCE method should be S256"
    );
}

#[tokio::test]
async fn start_rejects_disabled_provider() {
    // When enabled=false, MockConfigStore returns None → ProviderNotConfigured.
    let engine = mk_engine("google", false, vec!["login"], vec![]);
    let req = StartRequest {
        tenant_id: Uuid::new_v4(),
        provider_key: "google".into(),
        user_id: None,
        purpose: OAuthPurpose::Login,
        redirect_after: None,
        requested_scopes: vec![],
        override_client_id: None,
    };
    let err = engine.start(req, mk_creds()).await.unwrap_err();
    assert!(
        matches!(err, OAuthError::ProviderNotConfigured),
        "disabled provider should yield ProviderNotConfigured"
    );
}

#[tokio::test]
async fn start_rejects_disallowed_purpose() {
    let engine = mk_engine("google", true, vec!["login"], vec!["openid"]);
    let req = StartRequest {
        tenant_id: Uuid::new_v4(),
        provider_key: "google".into(),
        user_id: Some(Uuid::new_v4()),
        purpose: OAuthPurpose::Integration, // not in purposes
        redirect_after: None,
        requested_scopes: vec![],
        override_client_id: None,
    };
    let err = engine.start(req, mk_creds()).await.unwrap_err();
    assert!(
        matches!(err, OAuthError::PurposeNotAllowed(OAuthPurpose::Integration)),
        "purpose not in config should yield PurposeNotAllowed(Integration)"
    );
}

#[tokio::test]
async fn start_includes_oidc_nonce_for_keycloak() {
    let engine = mk_engine(
        "keycloak_generic",
        true,
        vec!["login"],
        vec!["openid", "email", "profile"],
    );
    let req = StartRequest {
        tenant_id: Uuid::new_v4(),
        provider_key: "keycloak_generic".into(),
        user_id: None,
        purpose: OAuthPurpose::Login,
        redirect_after: None,
        requested_scopes: vec![],
        override_client_id: None,
    };
    // Keycloak uses template vars {base_url} and {realm} in its authorize_url.
    let resp = engine
        .start(req, mk_creds_keycloak())
        .await
        .expect("start with keycloak");
    assert!(
        resp.authorization_url.contains("nonce="),
        "OIDC provider (keycloak) must include nonce param"
    );
    assert!(
        resp.authorization_url
            .starts_with("https://keycloak.test/realms/myrealm/protocol/openid-connect/auth"),
        "URL should have template vars expanded"
    );
}
