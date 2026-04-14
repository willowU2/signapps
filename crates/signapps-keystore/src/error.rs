//! Error type for keystore operations.

use thiserror::Error;

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
