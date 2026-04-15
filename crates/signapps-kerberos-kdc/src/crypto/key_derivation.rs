//! Kerberos key derivation functions (string-to-key, PBKDF2).
//!
//! Implements string-to-key transformations for RC4-HMAC (RFC 4757)
//! and AES-CTS-HMAC-SHA1-96 (RFC 3962).

use md4::{Digest as Md4Digest, Md4};

/// Derive an RC4-HMAC key (NT hash) from a password.
///
/// The NT hash is `MD4(UTF-16LE(password))`. This is identical to the
/// Windows NT LAN Manager hash used for NTLM authentication.
///
/// # Examples
///
/// ```
/// use signapps_kerberos_kdc::crypto::key_derivation::nt_hash;
///
/// // Empty password has a well-known NT hash.
/// let h = nt_hash("");
/// assert_eq!(h, hex_literal::hex!("31d6cfe0d16ae931b73c59d7e0c089c0"));
/// ```
///
/// # Errors
///
/// This function is infallible and always returns a 16-byte array.
///
/// # Panics
///
/// No panics — MD4 accepts any input length.
pub fn nt_hash(password: &str) -> [u8; 16] {
    // Encode as UTF-16LE byte stream.
    let utf16: Vec<u8> = password
        .encode_utf16()
        .flat_map(|c| c.to_le_bytes())
        .collect();

    let mut hasher = Md4::new();
    hasher.update(&utf16);
    let result = hasher.finalize();

    let mut hash = [0u8; 16];
    hash.copy_from_slice(&result);
    hash
}

/// Derive an AES-256 session key from a password and salt using PBKDF2-HMAC-SHA1.
///
/// The salt for a principal `user` in realm `REALM` is typically the
/// concatenation `"REALMuser"` (RFC 3962 §4).
///
/// This uses PBKDF2 with HMAC-SHA1 and 4 096 iterations, producing 32 bytes
/// suitable for AES-256-CTS-HMAC-SHA1-96.
///
/// # Examples
///
/// ```
/// use signapps_kerberos_kdc::crypto::key_derivation::aes256_string_to_key;
///
/// let key = aes256_string_to_key("Password", "EXAMPLE.COMadmin");
/// assert_eq!(key.len(), 32);
/// ```
///
/// # Errors
///
/// This function is infallible.
///
/// # Panics
///
/// No panics — HMAC accepts any key length.
pub fn aes256_string_to_key(password: &str, salt: &str) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac_sha1(password.as_bytes(), salt.as_bytes(), 4096, &mut key);
    key
}

/// PBKDF2 with HMAC-SHA1 (RFC 2898 §5.2).
///
/// Fills `output` with derived key material.
fn pbkdf2_hmac_sha1(password: &[u8], salt: &[u8], iterations: u32, output: &mut [u8]) {
    use hmac::{Hmac, Mac};
    use sha1::Sha1;

    type HmacSha1 = Hmac<Sha1>;

    let key_len = output.len();
    let hash_len: usize = 20; // SHA-1 output size in bytes.
    let blocks = key_len.div_ceil(hash_len);

    let mut offset = 0;
    for block_num in 1..=(blocks as u32) {
        // U1 = PRF(Password, Salt || INT(i))
        let mut u = {
            let mut mac = HmacSha1::new_from_slice(password).expect("HMAC accepts any key length");
            mac.update(salt);
            mac.update(&block_num.to_be_bytes());
            mac.finalize().into_bytes().to_vec()
        };

        let mut result = u.clone();

        // U2..Uc = PRF(Password, U_{c-1})  XOR'd into result.
        for _ in 1..iterations {
            let mut mac = HmacSha1::new_from_slice(password).expect("HMAC accepts any key length");
            mac.update(&u);
            u = mac.finalize().into_bytes().to_vec();

            for (r, x) in result.iter_mut().zip(u.iter()) {
                *r ^= x;
            }
        }

        let remaining = (key_len - offset).min(hash_len);
        output[offset..offset + remaining].copy_from_slice(&result[..remaining]);
        offset += remaining;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use hex_literal::hex;

    #[test]
    fn nt_hash_known_value() {
        // MD4("") = 31d6cfe0d16ae931b73c59d7e0c089c0
        let h = nt_hash("");
        assert_eq!(h, hex!("31d6cfe0d16ae931b73c59d7e0c089c0"));
    }

    #[test]
    fn nt_hash_unicode() {
        // Non-ASCII password should produce a valid 16-byte hash without panicking.
        let h = nt_hash("Pässwörd");
        assert_eq!(h.len(), 16);
        // Must not be all-zero (sanity check).
        assert_ne!(h, [0u8; 16]);
    }

    #[test]
    fn aes256_key_length() {
        let key = aes256_string_to_key("Password", "EXAMPLE.COMadmin");
        assert_eq!(key.len(), 32);
        // Must not be all-zero.
        assert_ne!(key, [0u8; 32]);
    }
}
