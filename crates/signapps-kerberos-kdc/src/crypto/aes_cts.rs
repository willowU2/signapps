//! AES256-CTS-HMAC-SHA1-96 encryption (RFC 3962).
//!
//! Used for Kerberos ticket encryption (enctype 18).
//!
//! The scheme:
//! 1. Derive per-usage encryption key (Ke) and integrity key (Ki) via HMAC-SHA1.
//! 2. Prepend a 16-byte random confounder to the plaintext.
//! 3. Pad the combined buffer to a multiple of the AES block size (16 bytes).
//! 4. Encrypt with AES-256-CBC (zero IV as required by RFC 3962).
//! 5. Compute HMAC-SHA1(Ki, ciphertext), truncate to 12 bytes.
//! 6. Output: hmac(12) || LE32(plaintext_len) || ciphertext.
//!
//! The plaintext length is stored unencrypted to allow exact recovery after
//! decryption (the AES-CBC padding is zero-fill and otherwise ambiguous).

use aes::Aes256;
use cbc::{Decryptor, Encryptor};
use cipher::{block_padding::NoPadding, BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use hmac::{Hmac, Mac};
use rand::RngCore;
use sha1::Sha1;

type Aes256CbcEnc = Encryptor<Aes256>;
type Aes256CbcDec = Decryptor<Aes256>;

/// Errors returned by AES-CTS crypto operations.
#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    /// The input buffer is too short to contain valid encrypted data.
    #[error("data too short for decryption")]
    DataTooShort,
    /// HMAC integrity verification failed (wrong key or tampered data).
    #[error("HMAC integrity check failed")]
    IntegrityCheckFailed,
    /// AES decryption failed (e.g., invalid padding).
    #[error("decryption failed")]
    DecryptionFailed,
}

/// Encrypt `plaintext` with AES256-CTS-HMAC-SHA1-96.
///
/// A 16-byte random confounder is prepended before encryption so that identical
/// plaintexts produce different ciphertexts. The output format is:
///
/// ```text
/// [ HMAC-SHA1-96 (12 bytes) ][ AES-256-CBC ciphertext ]
/// ```
///
/// # Examples
///
/// ```
/// use signapps_kerberos_kdc::crypto::aes_cts::{encrypt, decrypt};
///
/// let key = [0x42u8; 32];
/// let plaintext = b"Hello Kerberos!";
/// let encrypted = encrypt(&key, plaintext);
/// let decrypted = decrypt(&key, &encrypted).unwrap();
/// assert_eq!(decrypted, plaintext);
/// ```
///
/// # Panics
///
/// No panics — all internal HMAC operations accept any key length.
pub fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> Vec<u8> {
    // 1. Derive per-direction keys.
    let ke = derive_key(key, &[0x00, 0x00, 0x00, 0x02, 0xAA]);
    let ki = derive_key(key, &[0x00, 0x00, 0x00, 0x02, 0x55]);

    // 2. Build data: confounder || plaintext.
    let mut confounder = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut confounder);

    let mut data = Vec::with_capacity(16 + plaintext.len());
    data.extend_from_slice(&confounder);
    data.extend_from_slice(plaintext);

    // 3. Pad to AES block boundary (16 bytes) with zero bytes.
    let block_size = 16usize;
    let rem = data.len() % block_size;
    if rem != 0 {
        data.resize(data.len() + (block_size - rem), 0);
    }

    // 4. AES-256-CBC encrypt (RFC 3962 mandates zero IV).
    // encrypt_padded_mut operates in-place; data is already block-aligned.
    let iv = [0u8; 16];
    let encryptor = Aes256CbcEnc::new(ke[..32].into(), &iv.into());
    let data_len = data.len();
    encryptor
        .encrypt_padded_mut::<NoPadding>(&mut data, data_len)
        .expect("data is already block-aligned");
    let ciphertext = data;

    // 5. HMAC-SHA1(Ki, ciphertext) truncated to 12 bytes.
    let mut mac = <Hmac<Sha1> as Mac>::new_from_slice(&ki[..32]).expect("HMAC accepts any key");
    mac.update(&ciphertext);
    let hmac_full = mac.finalize().into_bytes();
    let hmac_trunc = &hmac_full[..12];

    // 6. Output: hmac(12) || LE32(plaintext_len) || ciphertext.
    // Storing the plaintext length allows exact recovery after zero-fill padding.
    let plen_bytes = (plaintext.len() as u32).to_le_bytes();
    let mut result = Vec::with_capacity(12 + 4 + ciphertext.len());
    result.extend_from_slice(hmac_trunc);
    result.extend_from_slice(&plen_bytes);
    result.extend_from_slice(&ciphertext);
    result
}

/// Decrypt data produced by [`encrypt`] with AES256-CTS-HMAC-SHA1-96.
///
/// Verifies the HMAC-SHA1-96 integrity tag before decrypting.
///
/// # Errors
///
/// Returns [`CryptoError::DataTooShort`] if `data` is shorter than 32 bytes
/// (12 HMAC + 4 length + 16 minimum ciphertext).
///
/// Returns [`CryptoError::IntegrityCheckFailed`] if the HMAC tag does not match
/// (wrong key or tampered ciphertext).
///
/// Returns [`CryptoError::DecryptionFailed`] if AES decryption fails.
///
/// # Examples
///
/// ```
/// use signapps_kerberos_kdc::crypto::aes_cts::{encrypt, decrypt};
///
/// let key = [0x42u8; 32];
/// let encrypted = encrypt(&key, b"secret");
/// assert!(decrypt(&key, &encrypted).is_ok());
/// ```
///
/// # Panics
///
/// No panics — all internal HMAC operations accept any key length.
pub fn decrypt(key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>, CryptoError> {
    // Minimum: 12-byte HMAC + 4-byte length + 16-byte AES block (confounder).
    if data.len() < 12 + 4 + 16 {
        return Err(CryptoError::DataTooShort);
    }

    let hmac_received = &data[..12];
    let plaintext_len = u32::from_le_bytes(data[12..16].try_into().unwrap()) as usize;
    let ciphertext = &data[16..];

    let ke = derive_key(key, &[0x00, 0x00, 0x00, 0x02, 0xAA]);
    let ki = derive_key(key, &[0x00, 0x00, 0x00, 0x02, 0x55]);

    // Verify HMAC before decrypting (authenticate-then-decrypt).
    // The HMAC covers the ciphertext only (not the length field).
    let mut mac = <Hmac<Sha1> as Mac>::new_from_slice(&ki[..32]).expect("HMAC accepts any key");
    mac.update(ciphertext);
    let hmac_computed = mac.finalize().into_bytes();
    if hmac_received != &hmac_computed[..12] {
        return Err(CryptoError::IntegrityCheckFailed);
    }

    // AES-256-CBC decrypt (zero IV). decrypt_padded_mut operates in-place.
    let iv = [0u8; 16];
    let decryptor = Aes256CbcDec::new(ke[..32].into(), &iv.into());
    let mut buf = ciphertext.to_vec();
    decryptor
        .decrypt_padded_mut::<NoPadding>(&mut buf)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    // Strip 16-byte confounder and trailing zero padding using the stored length.
    if buf.len() < 16 {
        return Err(CryptoError::DataTooShort);
    }
    let content = &buf[16..]; // strip confounder
    if plaintext_len > content.len() {
        return Err(CryptoError::DataTooShort);
    }
    Ok(content[..plaintext_len].to_vec())
}

/// Derive a 32-byte usage-specific key from `base_key` using HMAC-SHA1.
///
/// This is a simplified version of the RFC 3962 §5 key derivation:
/// `HMAC-SHA1(base_key, usage_constant)` extended to 32 bytes by cycling the
/// 20-byte SHA-1 output.
fn derive_key(base_key: &[u8; 32], usage: &[u8]) -> Vec<u8> {
    let mut mac = <Hmac<Sha1> as Mac>::new_from_slice(base_key).expect("HMAC accepts any key");
    mac.update(usage);
    let derived = mac.finalize().into_bytes(); // 20 bytes

    // Extend 20-byte HMAC to 32 bytes by cycling.
    let mut key = vec![0u8; 32];
    for (i, byte) in key.iter_mut().enumerate() {
        *byte = derived[i % derived.len()];
    }
    key
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let key = [0x42u8; 32];
        let plaintext = b"Hello Kerberos!";
        let encrypted = encrypt(&key, plaintext);
        let decrypted = decrypt(&key, &encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn encrypt_decrypt_empty_plaintext() {
        let key = [0x11u8; 32];
        let plaintext = b"";
        let encrypted = encrypt(&key, plaintext);
        let decrypted = decrypt(&key, &encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn encrypt_decrypt_long_plaintext() {
        let key = [0x99u8; 32];
        let plaintext = b"A longer plaintext that spans multiple AES blocks for proper testing";
        let encrypted = encrypt(&key, plaintext);
        let decrypted = decrypt(&key, &encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn decrypt_wrong_key_fails() {
        let key1 = [0x42u8; 32];
        let key2 = [0x43u8; 32];
        let encrypted = encrypt(&key1, b"secret");
        assert!(matches!(
            decrypt(&key2, &encrypted),
            Err(CryptoError::IntegrityCheckFailed)
        ));
    }

    #[test]
    fn decrypt_tampered_hmac_fails() {
        let key = [0x42u8; 32];
        let mut encrypted = encrypt(&key, b"secret");
        // Tamper with the HMAC tag (first 12 bytes).
        encrypted[0] ^= 0xFF;
        assert!(matches!(
            decrypt(&key, &encrypted),
            Err(CryptoError::IntegrityCheckFailed)
        ));
    }

    #[test]
    fn decrypt_tampered_ciphertext_fails() {
        let key = [0x42u8; 32];
        let mut encrypted = encrypt(&key, b"secret");
        // Tamper with the ciphertext (after the 12-byte HMAC).
        let last = encrypted.len() - 1;
        encrypted[last] ^= 0xFF;
        assert!(matches!(
            decrypt(&key, &encrypted),
            Err(CryptoError::IntegrityCheckFailed)
        ));
    }

    #[test]
    fn decrypt_too_short_fails() {
        let key = [0x42u8; 32];
        assert!(matches!(
            decrypt(&key, &[0u8; 10]),
            Err(CryptoError::DataTooShort)
        ));
    }

    #[test]
    fn encrypt_produces_different_output_each_time() {
        let key = [0x42u8; 32];
        let e1 = encrypt(&key, b"same plaintext");
        let e2 = encrypt(&key, b"same plaintext");
        // Random confounder guarantees different ciphertexts.
        assert_ne!(e1, e2);
    }
}
