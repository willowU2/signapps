//! Stateless HMAC-signed FlowState for OAuth callbacks.

use thiserror::Error;

/// Errors from state signing/verification.
#[derive(Debug, Error)]
pub enum StateError {
    /// State token is malformed (missing separator, invalid base64, etc).
    #[error("malformed state token")]
    Malformed,
    /// HMAC signature does not verify.
    #[error("bad signature")]
    BadSignature,
    /// State has expired.
    #[error("state expired")]
    Expired,
    /// JSON deserialization failed.
    #[error("invalid state payload: {0}")]
    InvalidPayload(#[from] serde_json::Error),
}

/// Placeholder — implemented in Task 9.
#[allow(dead_code)]
pub struct FlowState;
