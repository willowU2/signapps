//! Authentication types and utilities.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// JWT claims for access tokens.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (user ID)
    pub sub: Uuid,
    /// Username
    pub username: String,
    /// User role
    pub role: i16,
    /// Expiration timestamp (Unix time)
    pub exp: i64,
    /// Issued at timestamp (Unix time)
    pub iat: i64,
    /// Token type ("access" or "refresh")
    pub token_type: String,
}

/// JWT configuration for token generation and validation.
#[derive(Debug, Clone)]
pub struct JwtConfig {
    /// Secret key for signing/verifying tokens.
    pub secret: String,
    /// Token issuer (iss claim).
    pub issuer: String,
    /// Token audience (aud claim).
    pub audience: String,
    /// Access token expiration in seconds.
    pub access_expiration: i64,
    /// Refresh token expiration in seconds.
    pub refresh_expiration: i64,
}

impl Default for JwtConfig {
    fn default() -> Self {
        Self {
            secret: "change-me-in-production".to_string(),
            issuer: "signapps".to_string(),
            audience: "signapps".to_string(),
            access_expiration: 900,     // 15 minutes
            refresh_expiration: 604800, // 7 days
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
