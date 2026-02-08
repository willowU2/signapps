//! JWT token handling.

use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use uuid::Uuid;

/// JWT claims.
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,        // User ID
    pub username: String,
    pub role: i16,
    pub exp: i64,         // Expiration timestamp
    pub iat: i64,         // Issued at timestamp
    pub token_type: String, // "access" or "refresh"
}

/// Token pair (access + refresh).
#[derive(Serialize)]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
}

/// Create access and refresh tokens for a user.
pub fn create_tokens(
    user_id: Uuid,
    username: &str,
    role: i16,
    secret: &str,
) -> Result<TokenPair> {
    let now = Utc::now();

    // Access token: 15 minutes
    let access_exp = now + Duration::minutes(15);
    let access_claims = Claims {
        sub: user_id,
        username: username.to_string(),
        role,
        exp: access_exp.timestamp(),
        iat: now.timestamp(),
        token_type: "access".to_string(),
    };

    let access_token = encode(
        &Header::default(),
        &access_claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    ).map_err(|e| Error::Internal(e.to_string()))?;

    // Refresh token: 7 days
    let refresh_exp = now + Duration::days(7);
    let refresh_claims = Claims {
        sub: user_id,
        username: username.to_string(),
        role,
        exp: refresh_exp.timestamp(),
        iat: now.timestamp(),
        token_type: "refresh".to_string(),
    };

    let refresh_token = encode(
        &Header::default(),
        &refresh_claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    ).map_err(|e| Error::Internal(e.to_string()))?;

    Ok(TokenPair {
        access_token,
        refresh_token,
        expires_in: 900, // 15 minutes in seconds
    })
}

/// Verify and decode a JWT token.
pub fn verify_token(token: &str, secret: &str) -> Result<Claims> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;

    Ok(token_data.claims)
}
