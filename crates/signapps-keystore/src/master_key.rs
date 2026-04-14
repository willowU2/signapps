//! Master key type.

use crate::KeystoreError;
use zeroize::Zeroize;

/// 32-byte AES-256 master key.
///
/// **Security-sensitive.** The raw key bytes are stored in `self.0` with
/// `pub(crate)` visibility so cryptographic primitives inside this crate
/// (HKDF derivation in `dek.rs`) can read them directly. The memory is
/// zeroed when this value is dropped.
pub struct MasterKey(pub(crate) [u8; 32]);

impl std::fmt::Debug for MasterKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("MasterKey([REDACTED])")
    }
}

impl MasterKey {
    /// Length in bytes.
    pub const LEN: usize = 32;

    /// Parse a 64-character hex string into a master key.
    ///
    /// Accepts leading/trailing whitespace (trimmed).
    ///
    /// # Errors
    ///
    /// - [`KeystoreError::InvalidHex`] if the string contains non-hex characters.
    /// - [`KeystoreError::InvalidLength`] if the decoded bytes are not exactly 32.
    pub fn from_hex(s: &str) -> Result<Self, KeystoreError> {
        let trimmed = s.trim();
        let bytes =
            hex::decode(trimmed).map_err(|e| KeystoreError::InvalidHex(e.to_string()))?;
        if bytes.len() != Self::LEN {
            return Err(KeystoreError::InvalidLength(bytes.len()));
        }
        let mut key = [0u8; 32];
        key.copy_from_slice(&bytes);
        Ok(Self(key))
    }
}

impl Drop for MasterKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

#[cfg(test)]
mod tests {
    include!("master_key/tests.rs");
}
