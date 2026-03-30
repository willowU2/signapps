//! MFA (Multi-Factor Authentication) handlers.

use axum::{
    extract::{Extension, State},
    Json,
};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use signapps_common::{Claims, Error, Result};
use signapps_db::repositories::UserRepository;
use totp_rs::{Algorithm, Secret, TOTP};
use uuid::Uuid;

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

    // Generate backup codes (plaintext) and hash them for storage
    let backup_codes = generate_backup_codes(8);
    store_backup_codes_hashed(&state.pool, user.id, &backup_codes).await?;

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

    if !crate::auth::verify_password(&payload.password, password_hash).await? {
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

/// Generate random backup codes (plaintext — only returned once to the user).
fn generate_backup_codes(count: usize) -> Vec<String> {
    let mut rng = rand::thread_rng();
    (0..count)
        .map(|_| {
            let code: u32 = rng.gen_range(10000000..99999999);
            format!("{:08}", code)
        })
        .collect()
}

/// Hash a single backup code with SHA-256, returning the hex digest.
fn hash_backup_code(code: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(code.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Delete any existing (unused) backup codes for the user and insert newly hashed ones.
async fn store_backup_codes_hashed(
    pool: &signapps_db::DatabasePool,
    user_id: Uuid,
    codes: &[String],
) -> Result<()> {
    // Remove previous pending codes (e.g. if setup is re-run)
    sqlx::query("DELETE FROM identity.mfa_backup_codes WHERE user_id = $1 AND is_used = false")
        .bind(user_id)
        .execute(&**pool)
        .await
        .map_err(|e| Error::Internal(format!("Failed to clear old backup codes: {}", e)))?;

    for code in codes {
        let code_hash = hash_backup_code(code);
        sqlx::query("INSERT INTO identity.mfa_backup_codes (user_id, code_hash) VALUES ($1, $2)")
            .bind(user_id)
            .bind(&code_hash)
            .execute(&**pool)
            .await
            .map_err(|e| Error::Internal(format!("Failed to store backup code hash: {}", e)))?;
    }

    Ok(())
}

/// Verify a recovery code against stored hashes. Marks it as used on success.
#[allow(dead_code)]
#[tracing::instrument(skip_all)]
pub async fn verify_and_consume_backup_code(
    pool: &signapps_db::DatabasePool,
    user_id: Uuid,
    code: &str,
) -> Result<bool> {
    let code_hash = hash_backup_code(code);

    let result = sqlx::query(
        r#"UPDATE identity.mfa_backup_codes
           SET is_used = true
           WHERE user_id = $1 AND code_hash = $2 AND is_used = false"#,
    )
    .bind(user_id)
    .bind(&code_hash)
    .execute(&**pool)
    .await
    .map_err(|e| Error::Internal(format!("Failed to verify backup code: {}", e)))?;

    Ok(result.rows_affected() > 0)
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

    #[test]
    fn test_backup_code_hashing_produces_different_hash_each_time() {
        // SHA-256 is deterministic — same input → same hash.
        // Two *different* codes must produce different hashes.
        let code_a = "12345678";
        let code_b = "87654321";
        let hash_a = hash_backup_code(code_a);
        let hash_b = hash_backup_code(code_b);
        assert_ne!(
            hash_a, hash_b,
            "Different codes must hash to different values"
        );
    }

    #[test]
    fn test_backup_code_hashing_is_deterministic() {
        let code = "12345678";
        let hash1 = hash_backup_code(code);
        let hash2 = hash_backup_code(code);
        assert_eq!(hash1, hash2, "Same code must always produce the same hash");
    }

    #[test]
    fn test_backup_code_hash_is_hex_string() {
        let code = "99887766";
        let hash = hash_backup_code(code);
        // SHA-256 hex is 64 chars
        assert_eq!(hash.len(), 64);
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_totp_secret_generation_produces_valid_base32() {
        let secret = Secret::generate_secret();
        let encoded = secret.to_encoded().to_string();
        // Base32 alphabet: A-Z and 2-7, optionally padded with '='
        let valid_chars = |c: char| c.is_ascii_uppercase() || ('2'..='7').contains(&c) || c == '=';
        assert!(!encoded.is_empty(), "Generated secret must not be empty");
        assert!(
            encoded.chars().all(valid_chars),
            "Generated secret must be valid base32: {}",
            encoded
        );
    }

    #[test]
    fn test_generate_backup_codes_are_unique() {
        let codes = generate_backup_codes(10);
        let unique: std::collections::HashSet<_> = codes.iter().collect();
        assert_eq!(
            unique.len(),
            codes.len(),
            "All backup codes should be unique"
        );
    }
}
