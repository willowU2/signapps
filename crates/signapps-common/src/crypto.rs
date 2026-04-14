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
