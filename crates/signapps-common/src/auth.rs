//! Authentication types and utilities.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// JWT algorithm selection.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JwtAlgorithm {
    /// HMAC-SHA256 — symmetric, requires `JWT_SECRET`.
    Hs256,
    /// RSA-SHA256 — asymmetric, requires PEM keys.
    Rs256,
}

/// JWT claims for access tokens.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (user ID)
    pub sub: Uuid,
    /// Username
    pub username: String,
    /// User role
    pub role: i16,
    /// Tenant ID for multi-tenant isolation (optional for backwards compatibility)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<Uuid>,
    /// Workspace IDs the user has access to (optional)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_ids: Option<Vec<Uuid>>,
    /// Expiration timestamp (Unix time)
    pub exp: i64,
    /// Issued at timestamp (Unix time)
    pub iat: i64,
    /// Token type ("access" or "refresh")
    pub token_type: String,
    /// Audience
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aud: Option<String>,
    /// Issuer
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub iss: Option<String>,
    /// Person ID (unified person model — links the user to a person record).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub person_id: Option<Uuid>,
    /// Login context ID — identifies which context (employee/client/supplier) is active.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context_id: Option<Uuid>,
    /// Context type: `employee`, `client`, `supplier`, `partner`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context_type: Option<String>,
    /// Company ID for the active context.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company_id: Option<Uuid>,
    /// Company display name for the active context.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company_name: Option<String>,
}

impl Claims {
    /// Get the tenant ID, returning None if not set.
    pub fn tenant_id(&self) -> Option<Uuid> {
        self.tenant_id
    }

    /// Check if the user has access to a specific workspace.
    pub fn has_workspace_access(&self, workspace_id: Uuid) -> bool {
        self.workspace_ids
            .as_ref()
            .is_some_and(|ids| ids.contains(&workspace_id))
    }
}

/// JWT configuration for token generation and validation.
///
/// Supports two modes:
/// - **HS256** (symmetric): uses a shared `secret`. Legacy / dev fallback.
/// - **RS256** (asymmetric): uses a PEM-encoded RSA key pair. Production mode.
///
/// # Algorithm selection
///
/// Use [`JwtConfig::from_env`] for automatic detection based on environment variables:
/// - `JWT_PRIVATE_KEY_PEM` set → RS256 (identity service, signs tokens)
/// - `JWT_PUBLIC_KEY_PEM` set → RS256 (other services, validates tokens only)
/// - Neither set + `JWT_SECRET` set → HS256 (legacy fallback)
#[derive(Debug, Clone)]
pub struct JwtConfig {
    /// Algorithm in use.
    pub algorithm: JwtAlgorithm,
    /// HS256 secret (used when `algorithm == Hs256`).
    pub secret: String,
    /// RS256 private key PEM (identity service only — used to sign tokens).
    /// `None` on services that only need to verify.
    pub private_key_pem: Option<String>,
    /// RS256 public key PEM (all services — used to verify tokens).
    /// `None` in HS256 mode.
    pub public_key_pem: Option<String>,
    /// Token issuer (iss claim).
    pub issuer: String,
    /// Token audience (aud claim).
    pub audience: String,
    /// Access token expiration in seconds.
    pub access_expiration: i64,
    /// Refresh token expiration in seconds.
    pub refresh_expiration: i64,
}

impl JwtConfig {
    /// Build a [`JwtConfig`] in RS256 mode for the **identity service** (has both keys).
    ///
    /// # Errors
    ///
    /// Returns an error string if either PEM is empty.
    pub fn rs256_signer(private_key_pem: String, public_key_pem: String) -> Self {
        Self {
            algorithm: JwtAlgorithm::Rs256,
            secret: String::new(),
            private_key_pem: Some(private_key_pem),
            public_key_pem: Some(public_key_pem),
            issuer: "signapps".to_string(),
            audience: "signapps".to_string(),
            access_expiration: 900,
            refresh_expiration: 604_800,
        }
    }

    /// Build a [`JwtConfig`] in RS256 mode for **verifying services** (public key only).
    pub fn rs256_verifier(public_key_pem: String) -> Self {
        Self {
            algorithm: JwtAlgorithm::Rs256,
            secret: String::new(),
            private_key_pem: None,
            public_key_pem: Some(public_key_pem),
            issuer: "signapps".to_string(),
            audience: "signapps".to_string(),
            access_expiration: 900,
            refresh_expiration: 604_800,
        }
    }

    /// Build a [`JwtConfig`] in HS256 mode (legacy / dev fallback).
    pub fn hs256(secret: String) -> Self {
        Self {
            algorithm: JwtAlgorithm::Hs256,
            secret,
            private_key_pem: None,
            public_key_pem: None,
            issuer: "signapps".to_string(),
            audience: "signapps".to_string(),
            access_expiration: 900,
            refresh_expiration: 604_800,
        }
    }

    /// Auto-detect algorithm from environment variables.
    ///
    /// Detection order:
    /// 1. `JWT_PRIVATE_KEY_PEM` set → RS256 signer mode (identity service)
    /// 2. `JWT_PUBLIC_KEY_PEM` set → RS256 verifier mode (other services)
    /// 3. `JWT_SECRET` set → HS256 mode (legacy fallback)
    ///
    /// # Panics
    ///
    /// Panics in release builds if no key material is provided at all.
    /// In debug builds with `SIGNAPPS_DEV=1`, falls back to an insecure HS256 secret.
    pub fn from_env() -> Self {
        // RS256 signer (identity service — has private key)
        if let Ok(private_pem) = std::env::var("JWT_PRIVATE_KEY_PEM") {
            if !private_pem.trim().is_empty() {
                let public_pem = std::env::var("JWT_PUBLIC_KEY_PEM").unwrap_or_default();
                if public_pem.trim().is_empty() {
                    panic!(
                        "JWT_PRIVATE_KEY_PEM is set but JWT_PUBLIC_KEY_PEM is missing. \
                         Both keys are required when using RS256."
                    );
                }
                tracing::info!("JWT: RS256 signer mode (private + public key loaded)");
                return Self::rs256_signer(
                    private_pem.trim().to_string(),
                    public_pem.trim().to_string(),
                );
            }
        }

        // RS256 verifier (other services — only public key)
        if let Ok(public_pem) = std::env::var("JWT_PUBLIC_KEY_PEM") {
            if !public_pem.trim().is_empty() {
                tracing::info!("JWT: RS256 verifier mode (public key loaded)");
                return Self::rs256_verifier(public_pem.trim().to_string());
            }
        }

        // HS256 legacy fallback
        match std::env::var("JWT_SECRET") {
            Ok(s) if s.len() >= 32 => {
                tracing::info!("JWT: HS256 mode (shared secret)");
                Self::hs256(s)
            },
            Ok(s) => {
                panic!(
                    "JWT_SECRET is too short ({} bytes). HS256 requires at least 32 bytes.",
                    s.len()
                );
            },
            Err(_) => {
                if cfg!(debug_assertions) && std::env::var("SIGNAPPS_DEV").is_ok() {
                    tracing::error!(
                        "JWT_SECRET not set — using insecure dev default. \
                         This MUST NOT be used in production!"
                    );
                    Self::hs256("dev_secret_change_in_production_32chars".to_string())
                } else {
                    panic!(
                        "No JWT key material found. Set JWT_PRIVATE_KEY_PEM + JWT_PUBLIC_KEY_PEM \
                         for RS256 (recommended) or JWT_SECRET for HS256 (legacy). \
                         In a development build, set SIGNAPPS_DEV=1 to allow an insecure default."
                    );
                }
            },
        }
    }

    /// Return the public key PEM for this config.
    ///
    /// Returns `Some` in RS256 mode, `None` in HS256 mode.
    pub fn public_key_pem(&self) -> Option<&str> {
        self.public_key_pem.as_deref()
    }

    /// Return `true` if this config can sign tokens (has a private key or HS256 secret).
    pub fn can_sign(&self) -> bool {
        match self.algorithm {
            JwtAlgorithm::Hs256 => !self.secret.is_empty(),
            JwtAlgorithm::Rs256 => self.private_key_pem.is_some(),
        }
    }

    /// Create a `JwtConfig` for use in tests.
    ///
    /// Always uses HS256 with the provided secret. The `secret` must be at least 32
    /// bytes long (HS256 minimum).
    ///
    /// # Panics
    ///
    /// Panics if `secret` is shorter than 32 bytes, to catch misconfigured
    /// test helpers early.
    #[cfg(test)]
    pub fn for_test(secret: &str) -> Self {
        assert!(
            secret.len() >= 32,
            "JWT test secret must be at least 32 bytes long, got {} bytes",
            secret.len()
        );
        Self {
            algorithm: JwtAlgorithm::Hs256,
            secret: secret.to_string(),
            private_key_pem: None,
            public_key_pem: None,
            issuer: "signapps".to_string(),
            audience: "signapps".to_string(),
            access_expiration: 900,
            refresh_expiration: 604800,
        }
    }
}

/// Token pair returned after authentication.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenPair {
    /// Access token (short-lived)
    pub access_token: String,
    /// Refresh token (long-lived)
    pub refresh_token: String,
    /// Token type (always "Bearer")
    pub token_type: String,
    /// Access token expiration in seconds
    pub expires_in: i64,
}
