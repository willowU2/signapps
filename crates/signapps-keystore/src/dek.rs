//! Data Encryption Keys derived from the master key via HKDF-SHA256.

use crate::MasterKey;

/// A 32-byte key derived via HKDF-SHA256 with a usage info label.
pub struct DataEncryptionKey(pub(crate) [u8; 32]);

impl DataEncryptionKey {
    /// Derive a DEK from a master key using HKDF-SHA256 with `info` as the label.
    pub fn derive_from(_master_key: &MasterKey, _info: &str) -> Self {
        unimplemented!("filled in Task 5")
    }

    /// Raw 32-byte key material (for AES-GCM primitives).
    pub(crate) fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}
