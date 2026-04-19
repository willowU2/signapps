//! HMAC-SHA256 access grant token signer/verifier.
//!
//! A grant token is a URL-safe string of the form:
//!
//! ```text
//! base64url(payload_json) "." base64url(hmac_sha256(secret, payload_json))
//! ```
//!
//! The payload is a compact JSON object carrying the minimum fields
//! the redirect handler and `verify` endpoint need. Raw tokens are
//! never persisted — the database holds only their SHA-256 hex digest
//! (`token_hash` column of `org_access_grants`), so a database leak
//! does not disclose live tokens.
//!
//! All encoding uses the URL-safe alphabet without padding so the
//! resulting string is safe to place in a URL path without further
//! escaping.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

// ============================================================================
// Errors
// ============================================================================

/// Errors returned by [`sign`] and [`verify`].
#[derive(Debug, Error)]
pub enum TokenError {
    /// The token layout (two base64url chunks separated by `.`) is wrong.
    #[error("malformed token")]
    Malformed,

    /// Base64 decoding of the payload or signature failed.
    #[error("invalid base64 segment")]
    InvalidBase64,

    /// JSON parsing of the payload failed.
    #[error("invalid payload json")]
    InvalidPayload,

    /// The HMAC signature did not match the payload.
    #[error("signature mismatch")]
    InvalidSignature,

    /// The token is well-formed and signed but past its expiry.
    #[error("token expired")]
    Expired,

    /// HMAC key setup failed (empty secret or invalid length).
    #[error("bad hmac key")]
    BadKey,
}

// ============================================================================
// Payload
// ============================================================================

/// The payload carried inside an access grant token.
///
/// Kept minimal so both the redirect handler and verify endpoint can
/// make a go/no-go decision without a round-trip to the database. The
/// database row is still the source of truth for revocation, last-use
/// and the exact permission set.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TokenPayload {
    /// Grant row id (foreign key into `org_access_grants.id`).
    pub grant_id: Uuid,
    /// Tenant that emitted the grant — used to derive the HMAC secret.
    pub tenant_id: Uuid,
    /// Resource target (e.g. `"document"`, `"folder"`).
    pub resource_type: String,
    /// Resource id the grant applies to.
    pub resource_id: Uuid,
    /// Optional natural expiry; enforced by [`verify`] when set.
    pub expires_at: Option<DateTime<Utc>>,
}

// ============================================================================
// Sign / verify
// ============================================================================

/// Sign `payload` with `secret` and return the serialized token.
///
/// # Errors
///
/// Returns [`TokenError::BadKey`] if the HMAC key is rejected (only
/// possible for an empty secret in the current `hmac` crate).
pub fn sign(payload: &TokenPayload, secret: &[u8]) -> Result<String, TokenError> {
    let json = serde_json::to_vec(payload).map_err(|_| TokenError::InvalidPayload)?;
    let mut mac = HmacSha256::new_from_slice(secret).map_err(|_| TokenError::BadKey)?;
    mac.update(&json);
    let sig = mac.finalize().into_bytes();

    let b64_payload = URL_SAFE_NO_PAD.encode(&json);
    let b64_sig = URL_SAFE_NO_PAD.encode(sig);
    Ok(format!("{b64_payload}.{b64_sig}"))
}

/// Verify `token` with `secret` and return the decoded payload.
///
/// Performs three checks in this order:
/// 1. Structural: the token has exactly two base64url segments.
/// 2. Cryptographic: the HMAC-SHA256 of the payload matches the
///    signature (constant-time via [`hmac::Mac::verify_slice`]).
/// 3. Temporal: if `payload.expires_at` is set, it must be strictly
///    in the future.
///
/// # Errors
///
/// See [`TokenError`] variants.
pub fn verify(token: &str, secret: &[u8]) -> Result<TokenPayload, TokenError> {
    let (b64_payload, b64_sig) = token.split_once('.').ok_or(TokenError::Malformed)?;
    if b64_payload.is_empty() || b64_sig.is_empty() {
        return Err(TokenError::Malformed);
    }

    let payload_bytes = URL_SAFE_NO_PAD
        .decode(b64_payload)
        .map_err(|_| TokenError::InvalidBase64)?;
    let sig_bytes = URL_SAFE_NO_PAD
        .decode(b64_sig)
        .map_err(|_| TokenError::InvalidBase64)?;

    let mut mac = HmacSha256::new_from_slice(secret).map_err(|_| TokenError::BadKey)?;
    mac.update(&payload_bytes);
    mac.verify_slice(&sig_bytes)
        .map_err(|_| TokenError::InvalidSignature)?;

    let payload: TokenPayload =
        serde_json::from_slice(&payload_bytes).map_err(|_| TokenError::InvalidPayload)?;

    if let Some(exp) = payload.expires_at {
        if Utc::now() >= exp {
            return Err(TokenError::Expired);
        }
    }

    Ok(payload)
}

/// Return the SHA-256 hex digest of a token — what gets stored in
/// `org_access_grants.token_hash`. The live token is never persisted.
#[must_use]
pub fn hash(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    let out = hasher.finalize();
    let mut s = String::with_capacity(out.len() * 2);
    for byte in out {
        use std::fmt::Write as _;
        let _ = write!(&mut s, "{byte:02x}");
    }
    s
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_payload() -> TokenPayload {
        TokenPayload {
            grant_id: Uuid::from_u128(1),
            tenant_id: Uuid::from_u128(2),
            resource_type: "document".to_string(),
            resource_id: Uuid::from_u128(3),
            expires_at: None,
        }
    }

    #[test]
    fn sign_then_verify_roundtrip() {
        let secret = b"super-secret-key-of-sufficient-len";
        let payload = sample_payload();

        let token = sign(&payload, secret).expect("sign ok");
        let decoded = verify(&token, secret).expect("verify ok");

        assert_eq!(decoded.grant_id, payload.grant_id);
        assert_eq!(decoded.tenant_id, payload.tenant_id);
        assert_eq!(decoded.resource_type, payload.resource_type);
        assert_eq!(decoded.resource_id, payload.resource_id);
        assert_eq!(decoded.expires_at, payload.expires_at);
    }

    #[test]
    fn tamper_rejected() {
        let secret = b"super-secret-key-of-sufficient-len";
        let payload = sample_payload();
        let token = sign(&payload, secret).expect("sign ok");

        // Flip one character of the signature segment (last char).
        let mut chars: Vec<char> = token.chars().collect();
        let last = chars.len() - 1;
        // Pick a different char from the URL-safe alphabet so it stays
        // decodable but breaks the MAC.
        chars[last] = if chars[last] == 'A' { 'B' } else { 'A' };
        let tampered: String = chars.into_iter().collect();

        let err = verify(&tampered, secret).expect_err("must fail");
        assert!(
            matches!(err, TokenError::InvalidSignature | TokenError::InvalidBase64),
            "expected invalid signature or base64, got {err:?}"
        );
    }

    #[test]
    fn expired_rejected() {
        let secret = b"super-secret-key-of-sufficient-len";
        let mut payload = sample_payload();
        payload.expires_at = Some(Utc::now() - chrono::Duration::seconds(1));
        let token = sign(&payload, secret).expect("sign ok");

        let err = verify(&token, secret).expect_err("must fail");
        assert!(matches!(err, TokenError::Expired), "got {err:?}");
    }

    #[test]
    fn hash_is_deterministic_hex() {
        let h1 = hash("abc.def");
        let h2 = hash("abc.def");
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64); // 32 bytes * 2 hex chars
        assert!(h1.chars().all(|c| c.is_ascii_hexdigit()));
    }
}
