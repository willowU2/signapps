//! MFA (Multi-Factor Authentication) handlers.

use axum::{
    extract::{Extension, State},
    Json,
};
use rand::Rng;
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use signapps_db::repositories::UserRepository;
use totp_rs::{Algorithm, Secret, TOTP};

use crate::AppState;

/// MFA setup response with secret and QR code.
#[derive(Debug, Serialize)]
pub struct MfaSetupResponse {
    /// Base32-encoded secret for manual entry
    pub secret: String,
    /// QR code as data URI (PNG image)
    pub qr_code: String,
    /// Backup codes for account recovery
    pub backup_codes: Vec<String>,
}

/// MFA verification request.
#[derive(Debug, Deserialize)]
pub struct MfaVerifyRequest {
    /// 6-digit TOTP code
    pub code: String,
}

/// MFA verification response.
#[derive(Debug, Serialize)]
pub struct MfaVerifyResponse {
    pub success: bool,
    pub message: String,
}

/// MFA disable request.
#[derive(Debug, Deserialize)]
pub struct MfaDisableRequest {
    /// Current password for verification
    pub password: String,
    /// Current TOTP code or backup code
    pub code: String,
}

/// Setup MFA for current user.
///
/// Generates a new TOTP secret and returns it with a QR code.
/// The user must verify a code before MFA is enabled.
#[tracing::instrument(skip(state))]
pub async fn setup(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<MfaSetupResponse>> {
    // Get user
    let user = UserRepository::find_by_id(&state.pool, claims.sub)
        .await?
        .ok_or(Error::NotFound("User not found".to_string()))?;

    // Check if MFA is already enabled
    if user.mfa_enabled {
        return Err(Error::BadRequest("MFA is already enabled".to_string()));
    }

    // Generate a new secret
    let secret = Secret::generate_secret();
    let secret_base32 = secret.to_encoded().to_string();

    // Create TOTP instance
    let secret_bytes = secret
        .to_bytes()
        .map_err(|e: totp_rs::SecretParseError| Error::Internal(e.to_string()))?;
    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret_bytes,
        Some("SignApps".to_string()),
        user.username.clone(),
    )
    .map_err(|e| Error::Internal(format!("TOTP creation failed: {}", e)))?;

    // Generate QR code
    let qr_code = totp
        .get_qr_base64()
        .map_err(|e| Error::Internal(format!("QR code generation failed: {}", e)))?;

    // Generate backup codes
    let backup_codes = generate_backup_codes(8);

    // Store secret in cache pending verification (10 min TTL)
    // MFA is NOT enabled yet — verify handler will enable it after code check
    state
        .cache
        .set(
            &format!("mfa_pending:{}", user.id),
            &secret_base32,
            std::time::Duration::from_secs(600),
        )
        .await;

    tracing::info!(user_id = %user.id, "MFA setup initiated");

    Ok(Json(MfaSetupResponse {
        secret: secret_base32,
        qr_code: format!("data:image/png;base64,{}", qr_code),
        backup_codes,
    }))
}

/// Verify MFA code and confirm MFA setup.
///
/// This must be called after setup to confirm MFA is working.
#[tracing::instrument(skip(state, payload))]
pub async fn verify(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<MfaVerifyRequest>,
) -> Result<Json<MfaVerifyResponse>> {
    // Validate code format
    if payload.code.len() != 6 || !payload.code.chars().all(|c| c.is_ascii_digit()) {
        return Err(Error::Validation("Code must be 6 digits".to_string()));
    }

    // Get user
    let user = UserRepository::find_by_id(&state.pool, claims.sub)
        .await?
        .ok_or(Error::NotFound("User not found".to_string()))?;

    // Retrieve pending MFA secret from cache (set during setup)
    let cache_key = format!("mfa_pending:{}", user.id);
    let secret = state
        .cache
        .get_checked(&cache_key)
        .await
        .ok_or(Error::BadRequest(
            "MFA setup not found or expired. Please run setup again.".to_string(),
        ))?;

    // Verify TOTP code using base32-encoded secret
    let secret_bytes = Secret::Encoded(secret.clone())
        .to_bytes()
        .map_err(|e| Error::Internal(format!("TOTP secret decode error: {}", e)))?;
    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret_bytes,
        Some("SignApps".to_string()),
        user.username.clone(),
    )
    .map_err(|e| Error::Internal(format!("TOTP error: {}", e)))?;

    let is_valid = totp.check_current(&payload.code).unwrap_or(false);

    if !is_valid {
        tracing::warn!(user_id = %user.id, "Invalid MFA code during verification");
        return Ok(Json(MfaVerifyResponse {
            success: false,
            message: "Invalid code. Please try again.".to_string(),
        }));
    }

    // Code verified — NOW enable MFA in the database
    UserRepository::enable_mfa(&state.pool, user.id, &secret).await?;

    // Remove pending cache entry
    state.cache.del(&cache_key).await;

    tracing::info!(user_id = %user.id, "MFA enabled successfully");

    Ok(Json(MfaVerifyResponse {
        success: true,
        message: "MFA has been enabled successfully.".to_string(),
    }))
}

/// Disable MFA for current user.
#[tracing::instrument(skip(state, payload))]
pub async fn disable(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<MfaDisableRequest>,
) -> Result<Json<MfaVerifyResponse>> {
    // Get user
    let user = UserRepository::find_by_id(&state.pool, claims.sub)
        .await?
        .ok_or(Error::NotFound("User not found".to_string()))?;

    // Verify password
    let password_hash = user.password_hash.as_ref().ok_or(Error::BadRequest(
        "Cannot disable MFA for LDAP users".to_string(),
    ))?;

    if !crate::auth::verify_password(&payload.password, password_hash)? {
        return Err(Error::InvalidCredentials);
    }

    // Verify MFA code
    let secret = user
        .mfa_secret
        .as_ref()
        .ok_or(Error::BadRequest("MFA is not enabled".to_string()))?;

    let secret_bytes = Secret::Encoded(secret.to_string())
        .to_bytes()
        .map_err(|e| Error::Internal(format!("TOTP secret decode error: {}", e)))?;
    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret_bytes,
        Some("SignApps".to_string()),
        user.username.clone(),
    )
    .map_err(|e| Error::Internal(format!("TOTP error: {}", e)))?;

    let is_valid = totp.check_current(&payload.code).unwrap_or(false);

    if !is_valid {
        return Err(Error::InvalidMfaCode);
    }

    // Disable MFA
    UserRepository::disable_mfa(&state.pool, user.id).await?;

    tracing::info!(user_id = %user.id, "MFA disabled");

    Ok(Json(MfaVerifyResponse {
        success: true,
        message: "MFA has been disabled.".to_string(),
    }))
}

/// Get MFA status for current user.
#[tracing::instrument(skip(state))]
pub async fn status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<MfaStatusResponse>> {
    let user = UserRepository::find_by_id(&state.pool, claims.sub)
        .await?
        .ok_or(Error::NotFound("User not found".to_string()))?;

    Ok(Json(MfaStatusResponse {
        enabled: user.mfa_enabled,
    }))
}

/// MFA status response.
#[derive(Debug, Serialize)]
pub struct MfaStatusResponse {
    pub enabled: bool,
}

/// Generate random backup codes.
fn generate_backup_codes(count: usize) -> Vec<String> {
    let mut rng = rand::thread_rng();
    (0..count)
        .map(|_| {
            let code: u32 = rng.gen_range(10000000..99999999);
            format!("{:08}", code)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_backup_codes_generation() {
        let codes = generate_backup_codes(8);
        assert_eq!(codes.len(), 8);
        for code in &codes {
            assert_eq!(code.len(), 8);
            assert!(code.chars().all(|c| c.is_ascii_digit()));
        }
    }
}
