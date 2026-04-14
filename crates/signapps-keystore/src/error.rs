//! Error types for keystore and cryptographic operations.

use thiserror::Error;

/// Errors from cryptographic operations using a [`crate::DataEncryptionKey`].
///
/// Mirrors the variant set from `signapps_common::crypto::CryptoError` so
/// callers can convert between the two without depending on both crates.
#[derive(Debug, Error)]
pub enum CryptoError {
    /// Ciphertext is shorter than the minimum valid size
    /// (version + nonce + authentication tag = 29 bytes).
    #[error("ciphertext too short: {0} bytes (minimum 29)")]
    TooShort(usize),

    /// Ciphertext version byte does not match any supported version.
    #[error("unsupported ciphertext version: {0:#x}")]
    UnsupportedVersion(u8),

    /// AES-GCM encryption or decryption failed, or UTF-8 conversion failed.
    #[error("AES-GCM operation failed: {0}")]
    AesGcm(String),
}

/// All keystore-level errors.
#[derive(Debug, Error)]
pub enum KeystoreError {
    /// `KEYSTORE_MASTER_KEY` env var not set or empty.
    #[error("KEYSTORE_MASTER_KEY env var not set")]
    EnvVarNotSet,

    /// File backend: I/O error reading the master key file.
    #[error("failed to read master key file: {0}")]
    FileRead(#[from] std::io::Error),

    /// Hex decoding failed (not a valid 64-char hex string).
    #[error("invalid hex: {0}")]
    InvalidHex(String),

    /// Decoded key is not exactly 32 bytes.
    #[error("master key must be exactly 32 bytes, got {0}")]
    InvalidLength(usize),

    /// Remote KMS returned an error.
    #[error("remote keystore error: {0}")]
    Remote(String),
}
