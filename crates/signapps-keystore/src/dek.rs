//! Data Encryption Keys derived from the master key via HKDF-SHA256.

use crate::MasterKey;
use hkdf::Hkdf;
use sha2::Sha256;
use zeroize::Zeroize;

/// A 32-byte key derived via HKDF-SHA256 with a usage info label.
///
/// Each DEK is cryptographically independent of DEKs derived with a
/// different `info` label, so compromise of one usage's DEK does not
/// expose the others. The key material is zeroed on drop.
pub struct DataEncryptionKey(pub(crate) [u8; 32]);

impl DataEncryptionKey {
    /// Derive a DEK from a master key using HKDF-SHA256.
    ///
    /// `info` is the usage label (e.g., `"oauth-tokens-v1"`); it ensures
    /// that DEKs used for different purposes are cryptographically
    /// independent. No salt is used (deriving from a high-entropy master
    /// key — HKDF RFC 5869 Section 3.1 allows empty salt).
    ///
    /// # Panics
    ///
    /// Never — HKDF-SHA256 with a 32-byte IKM and a 32-byte OKM is always
    /// within the allowed parameter range (255 * 32 bytes max).
    #[must_use]
    pub fn derive_from(master_key: &MasterKey, info: &str) -> Self {
        let hk = Hkdf::<Sha256>::new(None, &master_key.0);
        let mut okm = [0u8; 32];
        hk.expand(info.as_bytes(), &mut okm)
            .expect("HKDF-SHA256 with 32-byte OKM is always within bounds");
        Self(okm)
    }

    /// Expose the raw 32-byte key material.
    ///
    /// **Do not use** unless you are a cryptographic primitive (AES-GCM,
    /// ChaCha20-Poly1305, etc.). Call sites should go through
    /// [`EncryptedField`](../signapps_common/crypto/trait.EncryptedField.html)
    /// in `signapps-common::crypto` instead.
    #[must_use]
    pub fn expose_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

impl Drop for DataEncryptionKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

#[cfg(test)]
mod tests {
    include!("dek/tests.rs");
}
