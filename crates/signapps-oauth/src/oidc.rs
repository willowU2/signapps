//! OpenID Connect id_token validation.
//!
//! For MVP this validates id_tokens using a static public key supplied
//! per provider via `extra_params.id_token_pub_key`. Full JWK rotation
//! via the provider's `jwks_uri` is a follow-up task.

use crate::error::OAuthError;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;

/// Subset of OIDC claims we validate.
#[derive(Debug, Deserialize)]
pub struct OidcClaims {
    /// `sub` — the OpenID subject (user ID).
    pub sub: String,
    /// `aud` — the audience (must match our client_id).
    pub aud: String,
    /// `iss` — the issuer (informational; some providers include).
    #[serde(default)]
    pub iss: Option<String>,
    /// `nonce` — must match the FlowState nonce.
    #[serde(default)]
    pub nonce: Option<String>,
    /// `email` — optional.
    #[serde(default)]
    pub email: Option<String>,
    /// `email_verified` — optional.
    #[serde(default)]
    pub email_verified: Option<bool>,
    /// `name` — optional.
    #[serde(default)]
    pub name: Option<String>,
    /// `exp` — expiration timestamp.
    pub exp: i64,
}

/// Validate an OIDC id_token.
///
/// Steps:
/// 1. Decode the JWT using the supplied public key (PEM-encoded RSA or EC).
/// 2. Verify `aud` matches `expected_aud` (our client_id).
/// 3. Verify `nonce` matches `expected_nonce` (the FlowState nonce).
/// 4. `exp` is verified by jsonwebtoken automatically.
///
/// # Errors
///
/// Returns [`OAuthError::IdTokenInvalid`] for any failure.
pub fn validate_id_token(
    id_token: &str,
    public_key_pem: &str,
    expected_aud: &str,
    expected_nonce: &str,
    algorithm: Algorithm,
) -> Result<OidcClaims, OAuthError> {
    let key = match algorithm {
        Algorithm::RS256 | Algorithm::RS384 | Algorithm::RS512 => {
            DecodingKey::from_rsa_pem(public_key_pem.as_bytes())
                .map_err(|e| OAuthError::IdTokenInvalid(format!("bad RSA key: {e}")))?
        },
        Algorithm::ES256 | Algorithm::ES384 => DecodingKey::from_ec_pem(public_key_pem.as_bytes())
            .map_err(|e| OAuthError::IdTokenInvalid(format!("bad EC key: {e}")))?,
        _ => {
            return Err(OAuthError::IdTokenInvalid(format!(
                "unsupported algorithm: {algorithm:?}"
            )));
        },
    };

    let mut validation = Validation::new(algorithm);
    validation.set_audience(&[expected_aud]);
    // `exp` is checked by default; iss is not (some providers omit it).

    let data = decode::<OidcClaims>(id_token, &key, &validation)
        .map_err(|e| OAuthError::IdTokenInvalid(format!("jwt decode: {e}")))?;
    let claims = data.claims;

    if claims.nonce.as_deref() != Some(expected_nonce) {
        return Err(OAuthError::IdTokenInvalid(format!(
            "nonce mismatch: expected {expected_nonce:?}, got {:?}",
            claims.nonce
        )));
    }

    Ok(claims)
}

#[cfg(test)]
mod tests {
    // Real cryptographic test vectors require generating an RSA key
    // pair. We test the failure paths here; cryptographic round-trip
    // tests live in tests/oidc_roundtrip.rs (Task 8 — integration tests
    // that generate a transient key with `openssl genpkey`).

    use super::*;

    #[test]
    fn rejects_unsupported_algorithm() {
        let err = validate_id_token(
            "doesnt.matter.here",
            "----- not even a key -----",
            "aud",
            "nonce",
            Algorithm::HS256,
        )
        .unwrap_err();
        assert!(matches!(err, OAuthError::IdTokenInvalid(s) if s.contains("unsupported")));
    }

    #[test]
    fn rejects_bad_pem() {
        let err = validate_id_token(
            "doesnt.matter.here",
            "not-a-pem-block",
            "aud",
            "nonce",
            Algorithm::RS256,
        )
        .unwrap_err();
        assert!(matches!(err, OAuthError::IdTokenInvalid(s) if s.contains("bad RSA key")));
    }

    #[test]
    fn rejects_invalid_jwt_format() {
        // Use a minimal 2048-bit RSA public key for the test (well-formed PEM)
        let pem = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyMV5oTlH2g5TBDVUm1mP\nU3R1S9wO+B+lLMAt1Cz3ujEWjZTTBtL+oyP8L/4tFb/I1H3aZHuMfVBkMzJTpcZv\nE8C5oMylyvJ+5K1aLBgkmcM8Y2HxgN7LX2VTW0RXl4N8eWlR2lFyYHC7BG8b1Vfx\nxiEmpPpiNcDdiSfCfyQXSPdUiQbpMnbuHbBTkUF+Bvyq7OTV5HXVCuYjMc0WQXEF\nIlJl0Vym2NexVCgaHOJ1MqFqJ9d8pEv3jVz0jh2WUz7LGhPQrVYpGjz5RYK2eRbC\nzdy8FJEIqeGKhxX8wpMXh/2hM6aZkKEN6r4cRJgJ2nN5KnxhpNd0RYx0+HGuYj9T\ndQIDAQAB\n-----END PUBLIC KEY-----\n";
        let err =
            validate_id_token("not.a.jwt", pem, "aud", "nonce", Algorithm::RS256).unwrap_err();
        assert!(matches!(err, OAuthError::IdTokenInvalid(_)));
    }
}
