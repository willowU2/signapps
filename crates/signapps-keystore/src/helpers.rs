//! Convenience wrappers for the very common `String ↔ Vec<u8>` encryption case.
//!
//! These helpers perform AES-256-GCM encryption/decryption on UTF-8 strings
//! using a [`DataEncryptionKey`], producing the same ciphertext format as
//! `signapps_common::crypto::EncryptedField`:
//!
//! ```text
//! version(1 byte) || nonce(12 bytes) || aes_gcm(plaintext, dek) || tag(16 bytes)
//! ```

use crate::{CryptoError, DataEncryptionKey};
use std::sync::Arc;

/// Current ciphertext format version byte.
const CURRENT_VERSION: u8 = 0x01;

/// AES-GCM nonce length in bytes.
const NONCE_LEN: usize = 12;

/// Minimum valid ciphertext length: version(1) + nonce(12) + tag(16).
const MIN_CT_LEN: usize = 1 + NONCE_LEN + 16;

/// Encrypt a UTF-8 string with the given DEK.
///
/// Caller chooses whether to pass `&Arc<DataEncryptionKey>` (cheap
/// clone) or `&DataEncryptionKey` (already-borrowed). Use `Arc::as_ref`
/// or `&*arc` if you have the `Arc`.
///
/// # Errors
///
/// Returns [`CryptoError::AesGcm`] if the AES-GCM primitive fails.
pub fn encrypt_string(plaintext: &str, dek: &DataEncryptionKey) -> Result<Vec<u8>, CryptoError> {
    use aes_gcm::aead::{Aead, KeyInit};
    use aes_gcm::{Aes256Gcm, Nonce};
    use rand::RngCore;

    let cipher = Aes256Gcm::new_from_slice(dek.expose_bytes())
        .map_err(|e| CryptoError::AesGcm(e.to_string()))?;

    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ct_and_tag = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| CryptoError::AesGcm(e.to_string()))?;

    let mut out = Vec::with_capacity(1 + NONCE_LEN + ct_and_tag.len());
    out.push(CURRENT_VERSION);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ct_and_tag);
    Ok(out)
}

/// Decrypt a ciphertext into a UTF-8 string.
///
/// # Errors
///
/// - [`CryptoError::TooShort`] / [`CryptoError::UnsupportedVersion`] /
///   [`CryptoError::AesGcm`] for cipher-level failures.
/// - Returns `CryptoError::AesGcm` with `"plaintext is not UTF-8"` if
///   the decrypted bytes are not valid UTF-8 (would only happen if a
///   non-UTF-8 byte sequence was encrypted, which is the caller's bug).
pub fn decrypt_string(ciphertext: &[u8], dek: &DataEncryptionKey) -> Result<String, CryptoError> {
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

    let bytes = cipher
        .decrypt(nonce, ct_and_tag)
        .map_err(|e| CryptoError::AesGcm(e.to_string()))?;

    String::from_utf8(bytes)
        .map_err(|e| CryptoError::AesGcm(format!("plaintext is not UTF-8: {e}")))
}

/// Variant that accepts `&Arc<DataEncryptionKey>` — the typical handle
/// returned by [`crate::Keystore::dek`].
///
/// # Errors
///
/// Same as [`encrypt_string`].
pub fn encrypt_string_arc(
    plaintext: &str,
    dek: &Arc<DataEncryptionKey>,
) -> Result<Vec<u8>, CryptoError> {
    encrypt_string(plaintext, dek.as_ref())
}

/// Variant that accepts `&Arc<DataEncryptionKey>`.
///
/// # Errors
///
/// Same as [`decrypt_string`].
pub fn decrypt_string_arc(
    ciphertext: &[u8],
    dek: &Arc<DataEncryptionKey>,
) -> Result<String, CryptoError> {
    decrypt_string(ciphertext, dek.as_ref())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Keystore, KeystoreBackend};

    const HEX: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    async fn test_dek() -> Arc<DataEncryptionKey> {
        let var = format!(
            "HELPERS_TEST_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        std::env::set_var(&var, HEX);
        let ks = Keystore::init(KeystoreBackend::EnvVarNamed(var.clone()))
            .await
            .unwrap();
        std::env::remove_var(&var);
        ks.dek("test-helpers")
    }

    #[tokio::test]
    async fn string_roundtrip() {
        let dek = test_dek().await;
        let ct = encrypt_string("ya29.token-with-special-chars-éàü", &dek).unwrap();
        let pt = decrypt_string(&ct, &dek).unwrap();
        assert_eq!(pt, "ya29.token-with-special-chars-éàü");
    }

    #[tokio::test]
    async fn arc_variant_works() {
        let dek = test_dek().await;
        let ct = encrypt_string_arc("hello", &dek).unwrap();
        let pt = decrypt_string_arc(&ct, &dek).unwrap();
        assert_eq!(pt, "hello");
    }

    #[tokio::test]
    async fn empty_string_roundtrips() {
        let dek = test_dek().await;
        let ct = encrypt_string("", &dek).unwrap();
        let pt = decrypt_string(&ct, &dek).unwrap();
        assert_eq!(pt, "");
    }

    // -----------------------------------------------------------------------
    // Phase F3 — adversarial regression tests for AES-GCM tamper detection.
    //
    // The crypto layer MUST reject modified ciphertext, wrong keys, and
    // malformed inputs. Silent acceptance would be a security bug.
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn decrypt_rejects_tampered_ciphertext() {
        let dek = test_dek().await;
        let mut ct = encrypt_string("top-secret-payload", &dek).unwrap();

        // Flip one bit in the middle of the AEAD payload (skip the
        // version byte at index 0 and nonce bytes 1..13).
        let flip_idx = 1 + NONCE_LEN + 2;
        ct[flip_idx] ^= 0x01;

        let result = decrypt_string(&ct, &dek);
        assert!(
            result.is_err(),
            "tampered ciphertext must be rejected by the AEAD tag check"
        );
    }

    #[tokio::test]
    async fn decrypt_rejects_wrong_dek() {
        // Set up two keystores with DIFFERENT master hex seeds — the
        // resulting DEKs (even with the same purpose) are independent.
        let hex_a = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        let hex_b = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

        let var_a = format!(
            "HELPERS_A_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let var_b = format!("{}B", var_a);
        std::env::set_var(&var_a, hex_a);
        std::env::set_var(&var_b, hex_b);

        let ks_a = Keystore::init(KeystoreBackend::EnvVarNamed(var_a.clone()))
            .await
            .unwrap();
        let ks_b = Keystore::init(KeystoreBackend::EnvVarNamed(var_b.clone()))
            .await
            .unwrap();
        std::env::remove_var(&var_a);
        std::env::remove_var(&var_b);

        let dek_a = ks_a.dek("payload");
        let dek_b = ks_b.dek("payload");

        let ct = encrypt_string("sensitive", &dek_a).unwrap();

        // Using a DEK from a different master key must fail (AEAD tag).
        let result = decrypt_string(&ct, &dek_b);
        assert!(
            result.is_err(),
            "ciphertext decrypted with a wrong master-derived DEK must be rejected"
        );
    }

    #[tokio::test]
    async fn decrypt_rejects_too_short_input() {
        let dek = test_dek().await;
        // Shorter than version(1) + nonce(12) + tag(16) = 29 bytes
        let short = vec![0x01, 0x00, 0x01, 0x02];
        let result = decrypt_string(&short, &dek);
        assert!(
            result.is_err(),
            "ciphertext shorter than min length must be rejected"
        );
    }

    #[tokio::test]
    async fn decrypt_rejects_unknown_version() {
        let dek = test_dek().await;
        let mut ct = encrypt_string("payload", &dek).unwrap();
        // Corrupt the version byte
        ct[0] = 0xFF;
        let result = decrypt_string(&ct, &dek);
        assert!(
            result.is_err(),
            "ciphertext with unknown version byte must be rejected"
        );
    }
}
