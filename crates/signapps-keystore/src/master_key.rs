//! Master key type.

/// 32-byte AES-256 master key.
///
/// **Security-sensitive.** The raw key bytes are stored in `self.0` with
/// `pub(crate)` visibility so cryptographic primitives inside this crate
/// (HKDF derivation in `dek.rs`) can read them directly. Zero-on-drop
/// via a `Drop` impl is added in Task 2.
// Field read by HKDF in dek.rs (Task 5) and zeroized by Drop (Task 2).
// Suppressed until those tasks land.
#[allow(dead_code)]
pub struct MasterKey(pub(crate) [u8; 32]);

impl MasterKey {
    /// Length in bytes.
    pub const LEN: usize = 32;
}
