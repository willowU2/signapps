//! Cryptographic primitives and traits shared across SignApps services.
//!
//! The main export (added in Task 8) is the `EncryptedField` trait, which
//! abstracts AES-256-GCM encryption for fields stored in the database.
//! Ciphertext format: `version(1 byte) || nonce(12 bytes) || ct+tag`.
//!
//! Task 7 introduces only the error type; the trait + impl land in Task 8.

use thiserror::Error;

/// Errors from cryptographic operations on encrypted fields.
///
/// These surface from the `EncryptedField::encrypt` / `decrypt` methods
/// and from helper functions in this module. Every variant maps to a
/// clear operational failure — either malformed ciphertext (`TooShort`,
/// `UnsupportedVersion`), tampered or wrong-key ciphertext (`AesGcm`),
/// or an underlying crypto primitive failure (`AesGcm`).
#[derive(Debug, Error)]
pub enum CryptoError {
    /// Ciphertext is shorter than the minimum valid size
    /// (version + nonce + authentication tag = 29 bytes).
    #[error("ciphertext too short: {0} bytes (minimum 29)")]
    TooShort(usize),

    /// Ciphertext version byte does not match any supported version.
    ///
    /// Emitted when a payload claims a ciphertext format version that
    /// this crate version does not know how to decrypt. Used to support
    /// key rotation across deploys.
    #[error("unsupported ciphertext version: {0:#x}")]
    UnsupportedVersion(u8),

    /// AES-GCM encryption or decryption failed.
    ///
    /// Common causes: invalid key size, authentication tag mismatch
    /// (tampered ciphertext or wrong key). The inner string carries the
    /// diagnostic message from the `aes-gcm` crate.
    #[error("AES-GCM operation failed: {0}")]
    AesGcm(String),
}

/// Current ciphertext format version.
///
/// Format: `VERSION(1) || NONCE(12) || CIPHERTEXT_AND_TAG(...)`. The
/// version byte enables future key rotation without downtime: deployers
/// can run with multiple DEKs and attempt each one in order of version.
pub const CURRENT_VERSION: u8 = 0x01;

/// Size of the AES-GCM nonce in bytes.
pub const NONCE_LEN: usize = 12;

/// Size of the AES-GCM authentication tag in bytes.
pub const TAG_LEN: usize = 16;

/// Minimum valid ciphertext size: version + nonce + empty-plaintext tag.
pub const MIN_CT_LEN: usize = 1 + NONCE_LEN + TAG_LEN;

/// Trait for fields stored encrypted at rest.
///
/// Implemented for the unit type `()` as the default AES-256-GCM primitive.
/// Tokens, secrets, and PII fields call `<()>::encrypt(&plaintext, dek)`
/// before DB writes and `<()>::decrypt(&ciphertext, dek)` after DB reads.
///
/// # Examples
///
/// ```no_run
/// # use signapps_common::crypto::{CryptoError, EncryptedField};
/// # use signapps_keystore::DataEncryptionKey;
/// fn store_token(token: &str, dek: &DataEncryptionKey) -> Result<Vec<u8>, CryptoError> {
///     <()>::encrypt(token.as_bytes(), dek)
/// }
///
/// fn read_token(ciphertext: &[u8], dek: &DataEncryptionKey) -> Result<String, CryptoError> {
///     let plaintext = <()>::decrypt(ciphertext, dek)?;
///     Ok(String::from_utf8(plaintext).expect("token was UTF-8 when encrypted"))
/// }
/// ```
pub trait EncryptedField: Sized {
    /// Encrypt a plaintext byte slice with the given DEK.
    ///
    /// # Errors
    ///
    /// Returns [`CryptoError::AesGcm`] if the AES-GCM primitive fails
    /// (extremely rare — implies a broken crypto library or an invalid
    /// key size which this wrapper should statically prevent).
    fn encrypt(
        plaintext: &[u8],
        dek: &signapps_keystore::DataEncryptionKey,
    ) -> Result<Vec<u8>, CryptoError>;

    /// Decrypt a ciphertext byte slice with the given DEK.
    ///
    /// # Errors
    ///
    /// - [`CryptoError::TooShort`] if `ciphertext.len() < MIN_CT_LEN`
    /// - [`CryptoError::UnsupportedVersion`] if the version byte is not
    ///   [`CURRENT_VERSION`] (`0x01`)
    /// - [`CryptoError::AesGcm`] if the authentication tag does not verify
    ///   (tampered ciphertext, wrong key, or wrong nonce)
    fn decrypt(
        ciphertext: &[u8],
        dek: &signapps_keystore::DataEncryptionKey,
    ) -> Result<Vec<u8>, CryptoError>;
}

impl EncryptedField for () {
    fn encrypt(
        plaintext: &[u8],
        dek: &signapps_keystore::DataEncryptionKey,
    ) -> Result<Vec<u8>, CryptoError> {
        use aes_gcm::aead::{Aead, KeyInit};
        use aes_gcm::{Aes256Gcm, Nonce};
        use rand::RngCore;

        let cipher = Aes256Gcm::new_from_slice(dek.expose_bytes())
            .map_err(|e| CryptoError::AesGcm(e.to_string()))?;

        let mut nonce_bytes = [0u8; NONCE_LEN];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ct_and_tag = cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| CryptoError::AesGcm(e.to_string()))?;

        let mut out = Vec::with_capacity(1 + NONCE_LEN + ct_and_tag.len());
        out.push(CURRENT_VERSION);
        out.extend_from_slice(&nonce_bytes);
        out.extend_from_slice(&ct_and_tag);
        Ok(out)
    }

    fn decrypt(
        ciphertext: &[u8],
        dek: &signapps_keystore::DataEncryptionKey,
    ) -> Result<Vec<u8>, CryptoError> {
        use aes_gcm::aead::{Aead, KeyInit};
        use aes_gcm::{Aes256Gcm, Nonce};

        if ciphertext.len() < MIN_CT_LEN {
            return Err(CryptoError::TooShort(ciphertext.len()));
        }
        if ciphertext[0] != CURRENT_VERSION {
            return Err(CryptoError::UnsupportedVersion(ciphertext[0]));
        }

        let nonce = Nonce::from_slice(&ciphertext[1..1 + NONCE_LEN]);
        let ct_and_tag = &ciphertext[1 + NONCE_LEN..];

        let cipher = Aes256Gcm::new_from_slice(dek.expose_bytes())
            .map_err(|e| CryptoError::AesGcm(e.to_string()))?;

        cipher
            .decrypt(nonce, ct_and_tag)
            .map_err(|e| CryptoError::AesGcm(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    include!("crypto/tests.rs");
}
