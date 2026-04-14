//! PKCE (Proof Key for Code Exchange, RFC 7636) helpers.
//!
//! Provides the two primitives needed to participate in an S256 PKCE flow:
//! - [`generate_verifier`] — creates a fresh high-entropy verifier string.
//! - [`challenge_s256`] — derives the SHA-256 challenge from a verifier.
//!
//! # Examples
//!
//! ```
//! use signapps_oauth::pkce::{generate_verifier, challenge_s256};
//!
//! let verifier  = generate_verifier();
//! let challenge = challenge_s256(&verifier);
//! assert_eq!(verifier.len(), 43);
//! assert_eq!(challenge.len(), 43);
//! ```

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use sha2::{Digest, Sha256};

/// Length in bytes of the raw random material used for the PKCE verifier.
///
/// 32 bytes → ceil(32 * 4 / 3) = 43 base64url characters (no padding).
/// This satisfies the RFC 7636 requirement of 43–128 character verifiers.
const VERIFIER_LEN: usize = 32;

/// Generate a fresh PKCE code verifier.
///
/// Fills 32 cryptographically random bytes and encodes them as URL-safe
/// base64 without padding, producing a 43-character string suitable for
/// use as the `code_verifier` parameter in an OAuth 2.0 + PKCE flow.
///
/// # Examples
///
/// ```
/// use signapps_oauth::pkce::generate_verifier;
/// let v = generate_verifier();
/// assert_eq!(v.len(), 43);
/// assert!(v.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
/// ```
#[must_use]
pub fn generate_verifier() -> String {
    let mut bytes = [0u8; VERIFIER_LEN];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

/// Derive the S256 `code_challenge` from a PKCE `code_verifier`.
///
/// Implements RFC 7636 §4.2:
/// ```text
/// code_challenge = BASE64URL(SHA-256(ASCII(code_verifier)))
/// ```
///
/// The result is a 43-character URL-safe base64 string (no padding) that
/// is sent to the authorization server in the initial authorization request.
/// The server stores the challenge and verifies it when the verifier is
/// presented during token exchange.
///
/// # Examples
///
/// ```
/// use signapps_oauth::pkce::challenge_s256;
///
/// // RFC 7636 Appendix A test vector
/// let verifier  = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
/// let challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
/// assert_eq!(challenge_s256(verifier), challenge);
/// ```
///
/// # Panics
///
/// Never — SHA-256 accepts input of any length, and base64url encoding is
/// infallible for fixed-size digests.
#[must_use]
pub fn challenge_s256(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let digest = hasher.finalize();
    URL_SAFE_NO_PAD.encode(digest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verifier_is_43_chars() {
        let v = generate_verifier();
        assert_eq!(v.len(), 43);
    }

    #[test]
    fn verifier_is_url_safe() {
        let v = generate_verifier();
        assert!(
            v.chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'),
            "verifier contains non-URL-safe character: {v}"
        );
    }

    #[test]
    fn challenge_is_43_chars() {
        let v = generate_verifier();
        let c = challenge_s256(&v);
        assert_eq!(c.len(), 43);
    }

    #[test]
    fn challenge_is_deterministic() {
        let v = "test_verifier_value";
        assert_eq!(challenge_s256(v), challenge_s256(v));
    }

    #[test]
    fn different_verifiers_yield_different_challenges() {
        let c1 = challenge_s256("verifier_a");
        let c2 = challenge_s256("verifier_b");
        assert_ne!(c1, c2);
    }

    #[test]
    fn rfc7636_test_vector() {
        // RFC 7636 Appendix A: S256 example.
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let expected = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
        assert_eq!(challenge_s256(verifier), expected);
    }
}
