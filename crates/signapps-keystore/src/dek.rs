//! Data Encryption Keys derived from the master key via HKDF-SHA256.

use crate::MasterKey;

/// A 32-byte key derived via HKDF-SHA256 with a usage info label.
// Field is unused in Task 1 scaffold; AES-GCM consumers arrive in Task 8.
#[allow(dead_code)]
pub struct DataEncryptionKey(pub(crate) [u8; 32]);

impl DataEncryptionKey {
    /// Derive a DEK from a master key using HKDF-SHA256 with `info` as the label.
    pub fn derive_from(_master_key: &MasterKey, _info: &str) -> Self {
        unimplemented!("filled in Task 5")
    }

    /// Raw 32-byte key material (for internal use by AES-GCM primitives).
    // Called by AES-GCM encrypt/decrypt in Task 8; unused in Task 1 scaffold.
    #[allow(dead_code)]
    pub(crate) fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}
