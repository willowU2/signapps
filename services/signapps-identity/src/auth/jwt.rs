//! JWT token handling for the identity service.
//!
//! Supports both HS256 (shared secret, legacy) and RS256 (asymmetric key pair,
//! production) depending on the configured [`signapps_common::JwtConfig`].

use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use signapps_common::{
    auth::{JwtAlgorithm, JwtConfig},
    Error, Result,
};
use uuid::Uuid;

/// JWT claims (identity-service local copy, matches `signapps_common::Claims`).
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid, // User ID
    pub username: String,
    pub role: i16,
    /// Tenant ID for multi-tenant isolation
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<Uuid>,
    /// Workspace IDs the user has access to
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_ids: Option<Vec<Uuid>>,
    pub exp: i64,           // Expiration timestamp
    pub iat: i64,           // Issued at timestamp
    pub token_type: String, // "access" or "refresh"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aud: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub iss: Option<String>,
}

/// Token pair (access + refresh).
#[derive(Serialize)]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
}

/// Create access and refresh tokens for a user using the provided [`JwtConfig`].
///
/// Supports both HS256 and RS256 depending on `config.algorithm`.
///
/// # Errors
///
/// Returns `Error::Internal` if encoding fails or if the config lacks the
/// required key material for signing (e.g. RS256 without a private key).
pub fn create_tokens(
    user_id: Uuid,
    username: &str,
    role: i16,
    tenant_id: Option<Uuid>,
    workspace_ids: Option<Vec<Uuid>>,
    config: &JwtConfig,
) -> Result<TokenPair> {
    let now = Utc::now();

    // Access token: 15 minutes
    let access_exp = now + Duration::minutes(15);
    let access_claims = Claims {
        sub: user_id,
        username: username.to_string(),
        role,
        tenant_id,
        workspace_ids: workspace_ids.clone(),
        exp: access_exp.timestamp(),
        iat: now.timestamp(),
        token_type: "access".to_string(),
        aud: Some(config.audience.clone()),
        iss: Some(config.issuer.clone()),
    };

    let (header, encoding_key) = build_encoding_key(config)?;

    let access_token = encode(&header, &access_claims, &encoding_key)
        .map_err(|e| Error::Internal(e.to_string()))?;

    // Refresh token: 7 days
    let refresh_exp = now + Duration::days(7);
    let refresh_claims = Claims {
        sub: user_id,
        username: username.to_string(),
        role,
        tenant_id,
        workspace_ids,
        exp: refresh_exp.timestamp(),
        iat: now.timestamp(),
        token_type: "refresh".to_string(),
        aud: Some(config.audience.clone()),
        iss: Some(config.issuer.clone()),
    };

    let refresh_token = encode(&header, &refresh_claims, &encoding_key)
        .map_err(|e| Error::Internal(e.to_string()))?;

    Ok(TokenPair {
        access_token,
        refresh_token,
        expires_in: 900, // 15 minutes in seconds
    })
}

/// Verify and decode a JWT token using the provided [`JwtConfig`].
///
/// # Errors
///
/// Returns an error if the token signature is invalid, expired, or the config
/// lacks the required key material for verification.
pub fn verify_token(token: &str, config: &JwtConfig) -> Result<Claims> {
    let (algorithm, decoding_key) = build_decoding_key(config)?;

    let mut validation = Validation::new(algorithm);
    // Use lenient audience/issuer validation — the common middleware handles
    // strict claim validation for incoming requests.
    validation.validate_aud = false;

    let token_data = decode::<Claims>(token, &decoding_key, &validation)?;
    Ok(token_data.claims)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Build the JWT [`Header`] and [`EncodingKey`] for the given config.
fn build_encoding_key(config: &JwtConfig) -> Result<(Header, EncodingKey)> {
    match config.algorithm {
        JwtAlgorithm::Hs256 => {
            let key = EncodingKey::from_secret(config.secret.as_bytes());
            Ok((Header::default(), key)) // Header::default() → HS256
        }
        JwtAlgorithm::Rs256 => {
            let pem = config.private_key_pem.as_deref().ok_or_else(|| {
                Error::Internal(
                    "RS256 mode requires JWT_PRIVATE_KEY_PEM to sign tokens".to_string(),
                )
            })?;
            let key = EncodingKey::from_rsa_pem(pem.as_bytes())
                .map_err(|e| Error::Internal(format!("Invalid RSA private key PEM: {e}")))?;
            Ok((Header::new(Algorithm::RS256), key))
        }
    }
}

/// Build the JWT [`Algorithm`] and [`DecodingKey`] for the given config.
fn build_decoding_key(config: &JwtConfig) -> Result<(Algorithm, DecodingKey)> {
    match config.algorithm {
        JwtAlgorithm::Hs256 => {
            let key = DecodingKey::from_secret(config.secret.as_bytes());
            Ok((Algorithm::HS256, key))
        }
        JwtAlgorithm::Rs256 => {
            let pem = config.public_key_pem.as_deref().ok_or_else(|| {
                Error::Internal(
                    "RS256 mode requires JWT_PUBLIC_KEY_PEM to verify tokens".to_string(),
                )
            })?;
            let key = DecodingKey::from_rsa_pem(pem.as_bytes())
                .map_err(|e| Error::Internal(format!("Invalid RSA public key PEM: {e}")))?;
            Ok((Algorithm::RS256, key))
        }
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SECRET: &str = "test-jwt-secret-that-is-long-enough-for-tests";

    fn test_user_id() -> Uuid {
        Uuid::parse_str("00000000-0000-0000-0000-000000000001").expect("valid uuid")
    }

    fn hs256_config() -> JwtConfig {
        JwtConfig::hs256(TEST_SECRET.to_string())
    }

    /// `create_tokens` produces a token pair where the access token expires in 900s.
    #[test]
    fn test_create_tokens_access_expires_in_900() {
        let pair = create_tokens(test_user_id(), "alice", 1, None, None, &hs256_config())
            .expect("should succeed");
        assert_eq!(pair.expires_in, 900, "access token TTL must be 900 seconds");
    }

    /// `create_tokens` encodes the username, role, and token_type into the claims.
    #[test]
    fn test_create_tokens_access_claims_roundtrip() {
        let tenant_id = Uuid::new_v4();
        let pair = create_tokens(
            test_user_id(),
            "bob",
            2,
            Some(tenant_id),
            None,
            &hs256_config(),
        )
        .expect("should succeed");

        let claims = verify_token(&pair.access_token, &hs256_config()).expect("should decode");
        assert_eq!(claims.sub, test_user_id());
        assert_eq!(claims.username, "bob");
        assert_eq!(claims.role, 2);
        assert_eq!(claims.tenant_id, Some(tenant_id));
        assert_eq!(claims.token_type, "access");
    }

    /// The refresh token carries `token_type = "refresh"`.
    #[test]
    fn test_create_tokens_refresh_type() {
        let pair = create_tokens(test_user_id(), "carol", 1, None, None, &hs256_config())
            .expect("should succeed");
        let claims =
            verify_token(&pair.refresh_token, &hs256_config()).expect("should decode refresh");
        assert_eq!(claims.token_type, "refresh");
    }

    /// `verify_token` with the wrong secret returns an error.
    #[test]
    fn test_verify_token_wrong_secret_fails() {
        let pair = create_tokens(test_user_id(), "dave", 1, None, None, &hs256_config())
            .expect("should succeed");
        let wrong_config = JwtConfig::hs256("completely-wrong-secret-value-xyz".to_string());
        let result = verify_token(&pair.access_token, &wrong_config);
        assert!(result.is_err(), "wrong secret must be rejected");
    }

    /// Workspace IDs are preserved in the claims after round-trip.
    #[test]
    fn test_create_tokens_workspace_ids_preserved() {
        let ws1 = Uuid::new_v4();
        let ws2 = Uuid::new_v4();
        let pair = create_tokens(
            test_user_id(),
            "eve",
            1,
            None,
            Some(vec![ws1, ws2]),
            &hs256_config(),
        )
        .expect("should succeed");
        let claims = verify_token(&pair.access_token, &hs256_config()).expect("should decode");
        let ids = claims.workspace_ids.expect("workspace_ids must be present");
        assert!(ids.contains(&ws1));
        assert!(ids.contains(&ws2));
    }

    /// Access and refresh tokens differ from each other.
    #[test]
    fn test_create_tokens_access_and_refresh_are_different() {
        let pair = create_tokens(test_user_id(), "frank", 1, None, None, &hs256_config())
            .expect("should succeed");
        assert_ne!(
            pair.access_token, pair.refresh_token,
            "access and refresh tokens must be distinct"
        );
    }
}
