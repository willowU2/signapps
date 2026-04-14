//! Master key type. Zeroizes on drop.

/// 32-byte AES-256 master key, zeroized on drop.
pub struct MasterKey(pub(crate) [u8; 32]);

impl MasterKey {
    /// Length in bytes.
    pub const LEN: usize = 32;
}
