//! End-to-End Encrypted Channels
//!
//! Simple E2E encryption for channels with XOR cipher stub (real crypto later).

use crate::error::Result;
use crate::types::UserId;
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// End-to-End Encrypted Channel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct E2eChannel {
    /// Unique channel identifier
    pub id: String,
    /// Channel name
    pub name: String,
    /// List of member user IDs
    pub members: Vec<UserId>,
    /// Hash of the encryption key (for verification)
    pub encryption_key_hash: String,
}

/// Manages E2E encrypted channels and message encryption/decryption
#[derive(Debug, Clone)]
pub struct E2eChannelManager {
    channels: HashMap<String, E2eChannel>,
}

impl E2eChannelManager {
    /// Create a new E2E channel manager
    pub fn new() -> Self {
        Self {
            channels: HashMap::new(),
        }
    }

    /// Create a new encrypted channel
    pub fn create_channel(
        &mut self,
        channel_id: String,
        name: String,
        members: Vec<UserId>,
        encryption_key: &str,
    ) -> Result<E2eChannel> {
        let encryption_key_hash = self.hash_key(encryption_key);

        let channel = E2eChannel {
            id: channel_id.clone(),
            name,
            members,
            encryption_key_hash,
        };

        self.channels.insert(channel_id, channel.clone());
        Ok(channel)
    }

    /// Encrypt a message using XOR cipher (stub for real crypto later)
    pub fn encrypt_message(&self, content: &str, key: &str) -> Result<String> {
        let encrypted_bytes = self.xor_cipher(content.as_bytes(), key.as_bytes());
        Ok(general_purpose::STANDARD.encode(encrypted_bytes))
    }

    /// Decrypt a message using XOR cipher (stub for real crypto later)
    pub fn decrypt_message(&self, encrypted: &str, key: &str) -> Result<String> {
        let encrypted_bytes = general_purpose::STANDARD
            .decode(encrypted)
            .map_err(|_| crate::error::Error::BadRequest("Invalid base64 encoding".into()))?;
        let decrypted_bytes = self.xor_cipher(&encrypted_bytes, key.as_bytes());
        String::from_utf8(decrypted_bytes)
            .map_err(|_| crate::error::Error::BadRequest("Invalid UTF-8 in decrypted message".into()))
    }

    /// Get a channel by ID
    pub fn get_channel(&self, channel_id: &str) -> Option<E2eChannel> {
        self.channels.get(channel_id).cloned()
    }

    /// Remove a channel
    pub fn remove_channel(&mut self, channel_id: &str) -> Option<E2eChannel> {
        self.channels.remove(channel_id)
    }

    /// List all channels
    pub fn list_channels(&self) -> Vec<E2eChannel> {
        self.channels.values().cloned().collect()
    }

    // ===== Private helpers =====

    /// Simple XOR cipher (stub - use real crypto in production)
    fn xor_cipher(&self, data: &[u8], key: &[u8]) -> Vec<u8> {
        data.iter()
            .enumerate()
            .map(|(i, byte)| byte ^ key[i % key.len()])
            .collect()
    }

    /// Hash encryption key
    fn hash_key(&self, key: &str) -> String {
        // Simple hash stub - in production use SHA-256 or similar
        format!("key_hash_{}", key.len())
    }
}

impl Default for E2eChannelManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_channel() {
        let mut manager = E2eChannelManager::new();
        let members = vec![UserId::new()];
        let key = "test_key_123";

        let channel = manager
            .create_channel("ch1".into(), "Test Channel".into(), members.clone(), key)
            .expect("Failed to create channel");

        assert_eq!(channel.id, "ch1");
        assert_eq!(channel.name, "Test Channel");
        assert_eq!(channel.members, members);
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let manager = E2eChannelManager::new();
        let key = "encryption_key";
        let original_message = "Hello, World!";

        let encrypted = manager
            .encrypt_message(original_message, key)
            .expect("Failed to encrypt");
        let decrypted = manager
            .decrypt_message(&encrypted, key)
            .expect("Failed to decrypt");

        assert_eq!(decrypted, original_message);
    }

    #[test]
    fn test_wrong_key_decryption() {
        let manager = E2eChannelManager::new();
        let original_message = "Secret";

        let encrypted = manager
            .encrypt_message(original_message, "correct_key")
            .expect("Failed to encrypt");

        let decrypted = manager
            .decrypt_message(&encrypted, "wrong_key")
            .expect("Failed to decrypt");

        // With XOR, decrypting with wrong key should give garbage
        assert_ne!(decrypted, original_message);
    }

    #[test]
    fn test_get_and_remove_channel() {
        let mut manager = E2eChannelManager::new();
        let members = vec![UserId::new()];

        manager
            .create_channel("ch1".into(), "Test".into(), members, "key")
            .expect("Failed to create");

        let channel = manager.get_channel("ch1");
        assert!(channel.is_some());

        let removed = manager.remove_channel("ch1");
        assert!(removed.is_some());
        assert!(manager.get_channel("ch1").is_none());
    }
}
