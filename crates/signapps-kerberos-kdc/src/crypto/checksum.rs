//! Kerberos checksum algorithms.
//!
//! Provides the two checksum types used in this KDC implementation:
//!
//! - **HMAC-SHA1-96-AES256** (checksum type 16, RFC 3962) — used with AES
//!   session keys.
//! - **HMAC-MD5** (checksum type -138, RFC 4757) — used with RC4-HMAC session
//!   keys.
//! - **MD5** — internal utility used by various Kerberos protocol operations.

use hmac::{Hmac, Mac};
use md5::Digest;
use sha1::Sha1;

/// Compute HMAC-SHA1-96 (checksum type 16, RFC 3962).
///
/// Produces a 12-byte (96-bit) truncated HMAC-SHA1 over `data` using `key`.
/// This is the integrity checksum used with AES256-CTS-HMAC-SHA1-96 (enctype 18).
///
/// # Examples
///
/// ```
/// use signapps_kerberos_kdc::crypto::checksum::hmac_sha1_96_aes256;
///
/// let key = [0x42u8; 32];
/// let cksum = hmac_sha1_96_aes256(&key, b"authenticator data");
/// assert_eq!(cksum.len(), 12);
/// ```
///
/// # Errors
///
/// This function is infallible.
///
/// # Panics
///
/// No panics — HMAC accepts any key length.
pub fn hmac_sha1_96_aes256(key: &[u8], data: &[u8]) -> [u8; 12] {
    let mut mac = <Hmac<Sha1> as Mac>::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(data);
    let full = mac.finalize().into_bytes(); // 20 bytes
    let mut truncated = [0u8; 12];
    truncated.copy_from_slice(&full[..12]);
    truncated
}

/// Compute HMAC-MD5 (checksum type -138, RFC 4757).
///
/// Produces a 16-byte HMAC-MD5 over `data` using `key`.
/// Used as the integrity checksum for RC4-HMAC (enctype 23) messages.
///
/// # Examples
///
/// ```
/// use signapps_kerberos_kdc::crypto::checksum::hmac_md5;
///
/// let key = [0x42u8; 16];
/// let cksum = hmac_md5(&key, b"kerberos data");
/// assert_eq!(cksum.len(), 16);
/// ```
///
/// # Errors
///
/// This function is infallible.
///
/// # Panics
///
/// No panics — HMAC accepts any key length.
pub fn hmac_md5(key: &[u8], data: &[u8]) -> [u8; 16] {
    let mut mac =
        <Hmac<md5::Md5> as Mac>::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(data);
    let result = mac.finalize().into_bytes();
    let mut out = [0u8; 16];
    out.copy_from_slice(&result);
    out
}

/// Compute a plain MD5 hash of `data`.
///
/// Returns a 16-byte digest. Used internally by several Kerberos protocol
/// operations (e.g., PA-DATA construction, nonce derivation).
///
/// # Examples
///
/// ```
/// use signapps_kerberos_kdc::crypto::checksum::md5_hash;
///
/// let digest = md5_hash(b"some data");
/// assert_eq!(digest.len(), 16);
/// // Same input always produces the same digest.
/// assert_eq!(digest, md5_hash(b"some data"));
/// ```
///
/// # Errors
///
/// This function is infallible.
///
/// # Panics
///
/// No panics — MD5 accepts any input length.
pub fn md5_hash(data: &[u8]) -> [u8; 16] {
    let mut hasher = md5::Md5::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut out = [0u8; 16];
    out.copy_from_slice(&result);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hmac_sha1_96_produces_12_bytes() {
        let key = [0x42u8; 32];
        let result = hmac_sha1_96_aes256(&key, b"test data");
        assert_eq!(result.len(), 12);
    }

    #[test]
    fn hmac_sha1_96_is_deterministic() {
        let key = [0x42u8; 32];
        let r1 = hmac_sha1_96_aes256(&key, b"same input");
        let r2 = hmac_sha1_96_aes256(&key, b"same input");
        assert_eq!(r1, r2);
    }

    #[test]
    fn hmac_sha1_96_different_keys_differ() {
        let key1 = [0x42u8; 32];
        let key2 = [0x43u8; 32];
        let r1 = hmac_sha1_96_aes256(&key1, b"same input");
        let r2 = hmac_sha1_96_aes256(&key2, b"same input");
        assert_ne!(r1, r2);
    }

    #[test]
    fn hmac_sha1_96_different_data_differ() {
        let key = [0x42u8; 32];
        let r1 = hmac_sha1_96_aes256(&key, b"input A");
        let r2 = hmac_sha1_96_aes256(&key, b"input B");
        assert_ne!(r1, r2);
    }

    #[test]
    fn hmac_md5_produces_16_bytes() {
        let key = [0x42u8; 16];
        let result = hmac_md5(&key, b"test data");
        assert_eq!(result.len(), 16);
    }

    #[test]
    fn hmac_md5_is_deterministic() {
        let key = [0x42u8; 16];
        let r1 = hmac_md5(&key, b"same input");
        let r2 = hmac_md5(&key, b"same input");
        assert_eq!(r1, r2);
    }

    #[test]
    fn hmac_md5_different_keys_differ() {
        let key1 = [0x42u8; 16];
        let key2 = [0x43u8; 16];
        let r1 = hmac_md5(&key1, b"data");
        let r2 = hmac_md5(&key2, b"data");
        assert_ne!(r1, r2);
    }

    #[test]
    fn md5_hash_produces_16_bytes() {
        let result = md5_hash(b"hello");
        assert_eq!(result.len(), 16);
    }

    #[test]
    fn md5_hash_is_deterministic() {
        let r1 = md5_hash(b"same input");
        let r2 = md5_hash(b"same input");
        assert_eq!(r1, r2);
    }

    #[test]
    fn md5_hash_known_value() {
        // MD5("") = d41d8cd98f00b204e9800998ecf8427e
        let empty_hash = md5_hash(b"");
        assert_eq!(
            empty_hash,
            [
                0xd4, 0x1d, 0x8c, 0xd9, 0x8f, 0x00, 0xb2, 0x04, 0xe9, 0x80, 0x09, 0x98, 0xec,
                0xf8, 0x42, 0x7e
            ]
        );
    }
}
