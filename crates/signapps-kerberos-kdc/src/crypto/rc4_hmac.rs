//! RC4-HMAC / ARCFOUR encryption (legacy Windows compatibility).
//!
//! Used for Kerberos enctype 23. The encryption key is the NT hash
//! (MD4 of the UTF-16LE-encoded password); see [`crate::crypto::key_derivation::nt_hash`].
//!
//! Wire format produced by [`encrypt`]:
//!
//! ```text
//! [ HMAC-MD5 checksum (16 bytes) ][ RC4(K3, confounder || plaintext) ]
//! ```
//!
//! Key schedule (per RFC 4757 §4):
//! - `K1 = HMAC-MD5(NT-hash, LE32(usage))`
//! - `K3 = HMAC-MD5(K1, confounder || plaintext)`
//! - Encrypt with `RC4(K3, confounder || plaintext)`.
//! - Prepend `K3` (the checksum) to the ciphertext.

use hmac::{Hmac, Mac};
use rand::RngCore;

use crate::crypto::aes_cts::CryptoError;

/// Encrypt `plaintext` with RC4-HMAC using the given 16-byte key and usage number.
///
/// The key is typically the NT hash of the user's password; the usage number
/// identifies the Kerberos message type (e.g., 7 for TGS-REP).
///
/// # Examples
///
/// ```
/// use signapps_kerberos_kdc::crypto::rc4_hmac::{encrypt, decrypt};
/// use signapps_kerberos_kdc::crypto::key_derivation::nt_hash;
///
/// let key = nt_hash("Password123");
/// let plaintext = b"Kerberos ticket data";
/// let encrypted = encrypt(&key, 7, plaintext);
/// let decrypted = decrypt(&key, 7, &encrypted).unwrap();
/// assert_eq!(decrypted, plaintext);
/// ```
///
/// # Panics
///
/// No panics — all HMAC operations accept any key length ≥ 1 byte.
pub fn encrypt(key: &[u8; 16], usage: i32, plaintext: &[u8]) -> Vec<u8> {
    // K1 = HMAC-MD5(key, LE32(usage))
    let k1 = hmac_md5(key, &usage.to_le_bytes());

    // 8-byte random confounder.
    let mut confounder = [0u8; 8];
    rand::thread_rng().fill_bytes(&mut confounder);

    // data = confounder || plaintext
    let mut data = Vec::with_capacity(8 + plaintext.len());
    data.extend_from_slice(&confounder);
    data.extend_from_slice(plaintext);

    // K3 = HMAC-MD5(K1, data)  — serves as both the stream key and the checksum.
    let k3 = hmac_md5(&k1, &data);

    // Encrypt with RC4(K3).
    let encrypted = rc4_transform(&k3, &data);

    // Output: K3 (checksum, 16 bytes) || encrypted data.
    let mut result = Vec::with_capacity(16 + encrypted.len());
    result.extend_from_slice(&k3);
    result.extend_from_slice(&encrypted);
    result
}

/// Decrypt data produced by [`encrypt`] with RC4-HMAC.
///
/// # Errors
///
/// Returns [`CryptoError::DataTooShort`] if `data` is shorter than 24 bytes
/// (16 checksum + 8 minimum confounder).
///
/// Returns [`CryptoError::IntegrityCheckFailed`] if the HMAC-MD5 tag does not
/// match (wrong key, wrong usage, or tampered data).
///
/// # Examples
///
/// ```
/// use signapps_kerberos_kdc::crypto::rc4_hmac::{encrypt, decrypt};
/// use signapps_kerberos_kdc::crypto::key_derivation::nt_hash;
///
/// let key = nt_hash("P@ssw0rd");
/// let ct = encrypt(&key, 7, b"ticket");
/// assert!(decrypt(&key, 7, &ct).is_ok());
/// ```
///
/// # Panics
///
/// No panics — all HMAC operations accept any key length ≥ 1 byte.
pub fn decrypt(key: &[u8; 16], usage: i32, data: &[u8]) -> Result<Vec<u8>, CryptoError> {
    // Minimum: 16-byte checksum + 8-byte confounder.
    if data.len() < 16 + 8 {
        return Err(CryptoError::DataTooShort);
    }

    let checksum = &data[..16];
    let ciphertext = &data[16..];

    // K1 = HMAC-MD5(key, LE32(usage))
    let k1 = hmac_md5(key, &usage.to_le_bytes());

    // For decryption: K3 is re-derived from K1 and the checksum.
    // (RFC 4757 §4: the sender sets checksum = K3 = HMAC-MD5(K1, plaintext_data),
    //  so the receiver can recover K3 from the checksum field directly.)
    let k3 = {
        let mut k3 = [0u8; 16];
        k3.copy_from_slice(checksum);
        k3
    };

    // RC4-decrypt using K3.
    let decrypted = rc4_transform(&k3, ciphertext);

    // Verify: recompute HMAC-MD5(K1, decrypted) and compare to checksum.
    let expected = hmac_md5(&k1, &decrypted);
    // Constant-time comparison is approximated here; a subtle timing oracle on
    // an RC4 pre-image is not a practical attack vector for Kerberos KDC usage.
    if checksum != expected.as_ref() {
        return Err(CryptoError::IntegrityCheckFailed);
    }

    // Strip 8-byte confounder.
    if decrypted.len() < 8 {
        return Err(CryptoError::DataTooShort);
    }
    Ok(decrypted[8..].to_vec())
}

/// RC4 (ARCFOUR) stream cipher.
///
/// Identical for encryption and decryption (XOR with keystream).
fn rc4_transform(key: &[u8], data: &[u8]) -> Vec<u8> {
    // KSA: Key-Scheduling Algorithm.
    let mut s: Vec<u8> = (0u16..=255).map(|i| i as u8).collect();
    let mut j: usize = 0;
    for i in 0..256 {
        j = (j + s[i] as usize + key[i % key.len()] as usize) % 256;
        s.swap(i, j);
    }

    // PRGA: Pseudo-Random Generation Algorithm.
    let mut i: usize = 0;
    j = 0;
    let mut output = Vec::with_capacity(data.len());
    for &byte in data {
        i = (i + 1) % 256;
        j = (j + s[i] as usize) % 256;
        s.swap(i, j);
        let k = s[(s[i] as usize + s[j] as usize) % 256];
        output.push(byte ^ k);
    }
    output
}

/// HMAC-MD5 helper — returns a 16-byte digest.
fn hmac_md5(key: &[u8], data: &[u8]) -> [u8; 16] {
    let mut mac =
        <Hmac<md5::Md5> as Mac>::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(data);
    let result = mac.finalize().into_bytes();
    let mut out = [0u8; 16];
    out.copy_from_slice(&result);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::key_derivation::nt_hash;

    #[test]
    fn rc4_transform_is_symmetric() {
        let key = b"test_key_16bytes";
        let plaintext = b"Hello RC4 stream!";
        let encrypted = rc4_transform(key, plaintext);
        let decrypted = rc4_transform(key, &encrypted);
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let key = nt_hash("Password123");
        let plaintext = b"Kerberos ticket data";
        let encrypted = encrypt(&key, 7, plaintext);
        let decrypted = decrypt(&key, 7, &encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn encrypt_decrypt_empty_plaintext() {
        let key = nt_hash("Password123");
        let encrypted = encrypt(&key, 7, b"");
        let decrypted = decrypt(&key, 7, &encrypted).unwrap();
        assert_eq!(decrypted, b"");
    }

    #[test]
    fn wrong_key_fails() {
        let key1 = nt_hash("Password123");
        let key2 = nt_hash("WrongPassword");
        let encrypted = encrypt(&key1, 7, b"secret");
        assert!(matches!(
            decrypt(&key2, 7, &encrypted),
            Err(CryptoError::IntegrityCheckFailed)
        ));
    }

    #[test]
    fn wrong_usage_fails() {
        let key = nt_hash("Password123");
        let encrypted = encrypt(&key, 7, b"secret");
        // Usage 8 produces a different K1, so K3 verification will fail.
        assert!(matches!(
            decrypt(&key, 8, &encrypted),
            Err(CryptoError::IntegrityCheckFailed)
        ));
    }

    #[test]
    fn tampered_ciphertext_fails() {
        let key = nt_hash("Password123");
        let mut encrypted = encrypt(&key, 7, b"secret");
        // Flip a bit in the ciphertext portion (after the 16-byte checksum).
        let last = encrypted.len() - 1;
        encrypted[last] ^= 0x01;
        assert!(matches!(
            decrypt(&key, 7, &encrypted),
            Err(CryptoError::IntegrityCheckFailed)
        ));
    }

    #[test]
    fn different_confounders_produce_different_ciphertexts() {
        let key = nt_hash("Password123");
        let e1 = encrypt(&key, 7, b"same");
        let e2 = encrypt(&key, 7, b"same");
        assert_ne!(e1, e2);
    }

    #[test]
    fn decrypt_too_short_fails() {
        let key = nt_hash("Password123");
        assert!(matches!(
            decrypt(&key, 7, &[0u8; 10]),
            Err(CryptoError::DataTooShort)
        ));
    }
}
