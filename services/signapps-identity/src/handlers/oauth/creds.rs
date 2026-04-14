//! Decrypt client_id/secret from an oauth_provider_configs row using
//! the keystore.

use signapps_common::crypto::EncryptedField;
use signapps_keystore::Keystore;
use signapps_oauth::{OAuthError, ProviderConfig, ResolvedCredentials};
use std::collections::HashMap;
use std::sync::Arc;

/// Decrypt the credentials in `cfg` using the keystore.
///
/// Resolves the `oauth-tokens-v1` DEK from the keystore, then decrypts
/// `client_id_enc`, `client_secret_enc`, and (if present) `extra_params_enc`
/// from `cfg`.
///
/// # Errors
///
/// - [`OAuthError::MissingParameter`] if `client_id_enc` or `client_secret_enc`
///   is `None` (provider was configured without credentials).
/// - [`OAuthError::Crypto`] if AES-GCM decryption fails for any field.
/// - [`OAuthError::Crypto`] if any decrypted field is not valid UTF-8.
/// - [`OAuthError::Crypto`] if `extra_params_enc` decrypts to non-JSON-map bytes.
pub fn resolve_credentials(
    cfg: &ProviderConfig,
    keystore: &Arc<Keystore>,
) -> Result<ResolvedCredentials, OAuthError> {
    let dek = keystore.dek("oauth-tokens-v1");

    let client_id_enc = cfg
        .client_id_enc
        .as_deref()
        .ok_or_else(|| OAuthError::MissingParameter("client_id".into()))?;
    let client_id_bytes = <()>::decrypt(client_id_enc, &dek)
        .map_err(|e| OAuthError::Crypto(format!("client_id decrypt: {e}")))?;
    let client_id = String::from_utf8(client_id_bytes)
        .map_err(|e| OAuthError::Crypto(format!("client_id is not UTF-8: {e}")))?;

    let client_secret_enc = cfg
        .client_secret_enc
        .as_deref()
        .ok_or_else(|| OAuthError::MissingParameter("client_secret".into()))?;
    let client_secret_bytes = <()>::decrypt(client_secret_enc, &dek)
        .map_err(|e| OAuthError::Crypto(format!("client_secret decrypt: {e}")))?;
    let client_secret = String::from_utf8(client_secret_bytes)
        .map_err(|e| OAuthError::Crypto(format!("client_secret is not UTF-8: {e}")))?;

    let extra_params = if let Some(extra_enc) = cfg.extra_params_enc.as_deref() {
        let bytes = <()>::decrypt(extra_enc, &dek)
            .map_err(|e| OAuthError::Crypto(format!("extra_params decrypt: {e}")))?;
        let s = String::from_utf8(bytes)
            .map_err(|e| OAuthError::Crypto(format!("extra_params is not UTF-8: {e}")))?;
        serde_json::from_str(&s)
            .map_err(|e| OAuthError::Crypto(format!("extra_params not JSON map: {e}")))?
    } else {
        HashMap::new()
    };

    Ok(ResolvedCredentials {
        client_id,
        client_secret,
        extra_params,
        override_id: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use signapps_common::crypto::EncryptedField;
    use signapps_keystore::{Keystore, KeystoreBackend};
    use uuid::Uuid;

    /// Build a throwaway keystore backed by an env var.
    ///
    /// This uses `KEYSTORE_MASTER_KEY` if set; otherwise the test is skipped
    /// because we cannot test DEK derivation without a key.
    async fn make_keystore() -> Option<Arc<Keystore>> {
        if std::env::var("KEYSTORE_MASTER_KEY").is_err() {
            return None;
        }
        let ks = Keystore::init(KeystoreBackend::EnvVar).await.ok()?;
        Some(Arc::new(ks))
    }

    fn make_config_with_creds(
        client_id_enc: Vec<u8>,
        client_secret_enc: Vec<u8>,
    ) -> ProviderConfig {
        ProviderConfig {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            provider_key: "google".into(),
            client_id_enc: Some(client_id_enc),
            client_secret_enc: Some(client_secret_enc),
            extra_params_enc: None,
            enabled: true,
            purposes: vec!["login".into()],
            allowed_scopes: vec![],
            visibility: "all".into(),
            visible_to_org_nodes: vec![],
            visible_to_groups: vec![],
            visible_to_roles: vec![],
            visible_to_users: vec![],
            allow_user_override: false,
            is_tenant_sso: false,
            auto_provision_users: false,
            default_role: None,
        }
    }

    #[tokio::test]
    async fn missing_client_id_enc_returns_missing_parameter() {
        let cfg = ProviderConfig {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            provider_key: "google".into(),
            client_id_enc: None,
            client_secret_enc: None,
            extra_params_enc: None,
            enabled: true,
            purposes: vec![],
            allowed_scopes: vec![],
            visibility: "all".into(),
            visible_to_org_nodes: vec![],
            visible_to_groups: vec![],
            visible_to_roles: vec![],
            visible_to_users: vec![],
            allow_user_override: false,
            is_tenant_sso: false,
            auto_provision_users: false,
            default_role: None,
        };

        // We need some keystore — but the error happens before the first
        // decrypt call, so the master key contents don't matter here.
        // Use a throwaway fixed key.
        std::env::set_var("KEYSTORE_MASTER_KEY", "0".repeat(64));
        let Some(ks) = make_keystore().await else {
            return;
        };

        let err = resolve_credentials(&cfg, &ks).unwrap_err();
        assert!(
            matches!(err, OAuthError::MissingParameter(ref p) if p == "client_id"),
            "expected MissingParameter(client_id), got {err:?}"
        );
    }

    #[tokio::test]
    async fn round_trip_encrypt_decrypt() {
        std::env::set_var("KEYSTORE_MASTER_KEY", "0".repeat(64));
        let Some(ks) = make_keystore().await else {
            return;
        };

        let dek = ks.dek("oauth-tokens-v1");
        let client_id_enc = <()>::encrypt(b"my-client-id", &dek).unwrap();
        let client_secret_enc = <()>::encrypt(b"my-client-secret", &dek).unwrap();

        let cfg = make_config_with_creds(client_id_enc, client_secret_enc);
        let creds = resolve_credentials(&cfg, &ks).unwrap();

        assert_eq!(creds.client_id, "my-client-id");
        assert_eq!(creds.client_secret, "my-client-secret");
        assert!(creds.extra_params.is_empty());
        assert!(creds.override_id.is_none());
    }

    #[tokio::test]
    async fn extra_params_round_trip() {
        std::env::set_var("KEYSTORE_MASTER_KEY", "0".repeat(64));
        let Some(ks) = make_keystore().await else {
            return;
        };

        let dek = ks.dek("oauth-tokens-v1");
        let client_id_enc = <()>::encrypt(b"cid", &dek).unwrap();
        let client_secret_enc = <()>::encrypt(b"csecret", &dek).unwrap();
        let extra_json = r#"{"key_id":"ABCD1234","team_id":"T123"}"#;
        let extra_params_enc = <()>::encrypt(extra_json.as_bytes(), &dek).unwrap();

        let mut cfg = make_config_with_creds(client_id_enc, client_secret_enc);
        cfg.extra_params_enc = Some(extra_params_enc);

        let creds = resolve_credentials(&cfg, &ks).unwrap();
        assert_eq!(
            creds.extra_params.get("key_id").map(|s| s.as_str()),
            Some("ABCD1234")
        );
        assert_eq!(
            creds.extra_params.get("team_id").map(|s| s.as_str()),
            Some("T123")
        );
    }
}
