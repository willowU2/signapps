use aes_gcm::aead::rand_core::RngCore;
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};

/// Represents a pii cipher.
pub struct PiiCipher {
    cipher: Aes256Gcm,
}

impl PiiCipher {
    /// Create from a 32-byte hex-encoded key
    pub fn from_hex_key(hex_key: &str) -> Result<Self, String> {
        let key_bytes = hex::decode(hex_key).map_err(|e| format!("invalid hex key: {e}"))?;
        if key_bytes.len() != 32 {
            return Err(format!("key must be 32 bytes, got {}", key_bytes.len()));
        }
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        Ok(Self {
            cipher: Aes256Gcm::new(key),
        })
    }

    /// Create from ENCRYPTION_KEY env var
    pub fn from_env() -> Result<Self, String> {
        let key = std::env::var("ENCRYPTION_KEY")
            .map_err(|_| "ENCRYPTION_KEY env var not set".to_string())?;
        Self::from_hex_key(&key)
    }

    /// Encrypt plaintext. Returns nonce (12 bytes) || ciphertext.
    pub fn encrypt(&self, plaintext: &str) -> Result<Vec<u8>, String> {
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = self
            .cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| format!("encryption failed: {e}"))?;
        let mut result = nonce_bytes.to_vec();
        result.extend(ciphertext);
        Ok(result)
    }

    /// Decrypt data (nonce || ciphertext). Returns plaintext.
    pub fn decrypt(&self, data: &[u8]) -> Result<String, String> {
        if data.len() < 13 {
            return Err("ciphertext too short".to_string());
        }
        let (nonce_bytes, ciphertext) = data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);
        let plaintext = self
            .cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| format!("decryption failed: {e}"))?;
        String::from_utf8(plaintext).map_err(|e| format!("invalid utf8: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_key() -> String {
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_string()
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let cipher = PiiCipher::from_hex_key(&test_key()).expect("valid test key");
        let plaintext = "user@example.com";
        let encrypted = cipher
            .encrypt(plaintext)
            .expect("encryption should succeed");
        assert_ne!(encrypted, plaintext.as_bytes());
        let decrypted = cipher
            .decrypt(&encrypted)
            .expect("decryption should succeed");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_different_nonces() {
        let cipher = PiiCipher::from_hex_key(&test_key()).expect("valid test key");
        let e1 = cipher
            .encrypt("same text")
            .expect("encryption should succeed");
        let e2 = cipher
            .encrypt("same text")
            .expect("encryption should succeed");
        assert_ne!(e1, e2);
        assert_eq!(
            cipher.decrypt(&e1).expect("decryption should succeed"),
            cipher.decrypt(&e2).expect("decryption should succeed")
        );
    }

    #[test]
    fn test_invalid_key_length() {
        assert!(PiiCipher::from_hex_key("tooshort").is_err());
    }

    #[test]
    fn test_tampered_ciphertext() {
        let cipher = PiiCipher::from_hex_key(&test_key()).expect("valid test key");
        let mut encrypted = cipher.encrypt("secret").expect("encryption should succeed");
        encrypted[15] ^= 0xFF;
        assert!(cipher.decrypt(&encrypted).is_err());
    }
}
