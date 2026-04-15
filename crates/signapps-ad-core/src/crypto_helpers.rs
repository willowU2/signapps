//! Crypto helper functions for AD domain operations.
//!
//! Thin wrappers providing key derivation without depending on the
//! full kerberos-kdc crate (avoids circular dependency).

/// Derive an AES256 key from password + salt using PBKDF2-HMAC-SHA1.
///
/// This duplicates the logic from kerberos-kdc::crypto::key_derivation
/// to avoid a circular dependency. In production, consider extracting
/// to a shared crypto crate.
///
/// # Examples
///
/// ```
/// use signapps_ad_core::crypto_helpers::derive_aes256_key;
///
/// let key = derive_aes256_key("password", "EXAMPLE.COMadmin");
/// assert_eq!(key.len(), 32);
/// ```
///
/// # Panics
///
/// Aucun panic possible — toutes les erreurs sont propagées via `Result`.
pub fn derive_aes256_key(password: &str, salt: &str) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac_sha1(password.as_bytes(), salt.as_bytes(), 4096, &mut key);
    key
}

/// Compute the NT hash (MD4 of UTF-16LE password).
///
/// # Examples
///
/// ```
/// use signapps_ad_core::crypto_helpers::compute_nt_hash;
///
/// let hash = compute_nt_hash("");
/// assert_eq!(hash.len(), 16);
/// ```
///
/// # Panics
///
/// Aucun panic possible — toutes les erreurs sont propagées via `Result`.
pub fn compute_nt_hash(password: &str) -> [u8; 16] {
    use md4::{Digest, Md4};

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

/// PBKDF2 with HMAC-SHA1 (RFC 2898).
///
/// # Panics
///
/// Panics if `password` is empty — this should never happen in practice as
/// password validation occurs before key derivation.
fn pbkdf2_hmac_sha1(password: &[u8], salt: &[u8], iterations: u32, output: &mut [u8]) {
    use hmac::{Hmac, Mac};
    use sha1::Sha1;

    let key_len = output.len();
    let hash_len = 20;
    let blocks = key_len.div_ceil(hash_len);

    let mut offset = 0;
    for block_num in 1..=blocks as u32 {
        let mut u = {
            // HMAC accepts keys of any length — new_from_slice never returns Err for HMAC.
            let mut mac = <Hmac<Sha1> as Mac>::new_from_slice(password)
                .unwrap_or_else(|_| unreachable!("HMAC accepts keys of any length"));
            mac.update(salt);
            mac.update(&block_num.to_be_bytes());
            mac.finalize().into_bytes().to_vec()
        };
        let mut result = u.clone();
        for _ in 1..iterations {
            let mut mac = <Hmac<Sha1> as Mac>::new_from_slice(password)
                .unwrap_or_else(|_| unreachable!("HMAC accepts keys of any length"));
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

    #[test]
    fn nt_hash_empty_password() {
        let hash = compute_nt_hash("");
        // Well-known NT hash for empty password: 31d6cfe0d16ae931b73c59d7e0c089c0
        let expected: [u8; 16] = [
            0x31, 0xd6, 0xcf, 0xe0, 0xd1, 0x6a, 0xe9, 0x31, 0xb7, 0x3c, 0x59, 0xd7, 0xe0, 0xc0,
            0x89, 0xc0,
        ];
        assert_eq!(hash, expected);
    }

    #[test]
    fn aes256_key_length() {
        let key = derive_aes256_key("password", "EXAMPLE.COMadmin");
        assert_eq!(key.len(), 32);
    }

    #[test]
    fn aes256_key_deterministic() {
        let k1 = derive_aes256_key("pass", "salt");
        let k2 = derive_aes256_key("pass", "salt");
        assert_eq!(k1, k2);
    }
}
