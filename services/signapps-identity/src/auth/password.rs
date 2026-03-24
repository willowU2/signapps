//! Password hashing with Argon2.

use signapps_common::{Error, Result};

/// Hash a password using Argon2id.
///
/// Runs the CPU-intensive key derivation on a blocking thread
/// to avoid stalling the async Tokio runtime.
pub async fn hash_password(password: &str) -> Result<String> {
    let password = password.to_string();
    tokio::task::spawn_blocking(move || {
        use argon2::{
            password_hash::rand_core::OsRng, password_hash::SaltString, Argon2, PasswordHasher,
        };

        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();

        let hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| Error::Internal(format!("Password hashing failed: {}", e)))?;

        Ok(hash.to_string())
    })
    .await
    .map_err(|e| Error::Internal(format!("Password hash task panicked: {}", e)))?
}

/// Verify a password against a stored hash.
///
/// Runs the CPU-intensive key derivation on a blocking thread
/// to avoid stalling the async Tokio runtime.
pub async fn verify_password(password: &str, hash: &str) -> Result<bool> {
    let password = password.to_string();
    let hash = hash.to_string();
    tokio::task::spawn_blocking(move || {
        use argon2::{password_hash::PasswordHash, Argon2, PasswordVerifier};

        let parsed_hash = PasswordHash::new(&hash)
            .map_err(|e| Error::Internal(format!("Invalid password hash: {}", e)))?;

        let argon2 = Argon2::default();

        Ok(argon2
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok())
    })
    .await
    .map_err(|e| Error::Internal(format!("Password verify task panicked: {}", e)))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_password_hash_and_verify() {
        let password = "test_password_123";
        let hash = hash_password(password).await.unwrap();

        assert!(verify_password(password, &hash).await.unwrap());
        assert!(!verify_password("wrong_password", &hash).await.unwrap());
    }
}
