//! SMB2 protocol types (MS-SMB2).
//!
//! Minimal implementation covering the operations needed for SYSVOL:
//! Negotiate, Session Setup, Tree Connect, Read, Query Directory.

/// SMB2 command codes (MS-SMB2 §2.2.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u16)]
pub enum Smb2Command {
    Negotiate = 0x0000,
    SessionSetup = 0x0001,
    Logoff = 0x0002,
    TreeConnect = 0x0003,
    TreeDisconnect = 0x0004,
    Create = 0x0005,
    Close = 0x0006,
    Read = 0x0008,
    Write = 0x0009,
    QueryDirectory = 0x000E,
    QueryInfo = 0x0010,
}

impl Smb2Command {
    /// Convert a raw u16 to an `Smb2Command`, returning `None` for unknown codes.
    pub fn from_u16(val: u16) -> Option<Self> {
        match val {
            0x0000 => Some(Self::Negotiate),
            0x0001 => Some(Self::SessionSetup),
            0x0002 => Some(Self::Logoff),
            0x0003 => Some(Self::TreeConnect),
            0x0004 => Some(Self::TreeDisconnect),
            0x0005 => Some(Self::Create),
            0x0006 => Some(Self::Close),
            0x0008 => Some(Self::Read),
            0x0009 => Some(Self::Write),
            0x000E => Some(Self::QueryDirectory),
            0x0010 => Some(Self::QueryInfo),
            _ => None,
        }
    }
}

/// SMB2 dialect versions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u16)]
pub enum Smb2Dialect {
    Smb202 = 0x0202,
    Smb210 = 0x0210,
    Smb300 = 0x0300,
    Smb302 = 0x0302,
    Smb311 = 0x0311,
}

impl Smb2Dialect {
    /// Convert a raw u16 to an `Smb2Dialect`, returning `None` for unknown dialects.
    pub fn from_u16(val: u16) -> Option<Self> {
        match val {
            0x0202 => Some(Self::Smb202),
            0x0210 => Some(Self::Smb210),
            0x0300 => Some(Self::Smb300),
            0x0302 => Some(Self::Smb302),
            0x0311 => Some(Self::Smb311),
            _ => None,
        }
    }
}

/// NT Status codes (subset relevant to SMB).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum NtStatus {
    Success = 0x00000000,
    MoreProcessingRequired = 0xC0000016,
    InvalidParameter = 0xC000000D,
    AccessDenied = 0xC0000022,
    ObjectNameNotFound = 0xC0000034,
    LogonFailure = 0xC000006D,
    BadNetworkName = 0xC00000CC,
    NotSupported = 0xC00000BB,
}

/// SMB2 header (64 bytes, MS-SMB2 §2.2.1).
#[derive(Debug, Clone)]
pub struct Smb2Header {
    /// Protocol identifier bytes: `[0xFE, 'S', 'M', 'B']`.
    pub protocol_id: [u8; 4],
    /// Structure size, always 64.
    pub structure_size: u16,
    /// Credit charge for the request.
    pub credit_charge: u16,
    /// NT Status code.
    pub status: u32,
    /// SMB2 command.
    pub command: Smb2Command,
    /// Credits granted or requested.
    pub credits: u16,
    /// Flags field.
    pub flags: u32,
    /// Offset to the next SMB2 command (0 if single).
    pub next_command: u32,
    /// Message identifier.
    pub message_id: u64,
    /// Tree identifier.
    pub tree_id: u32,
    /// Session identifier.
    pub session_id: u64,
    /// Message signature (16 bytes).
    pub signature: [u8; 16],
}

impl Smb2Header {
    /// SMB2 protocol magic bytes.
    pub const MAGIC: [u8; 4] = [0xFE, b'S', b'M', b'B'];

    /// Check if bytes start with the SMB2 magic.
    pub fn is_smb2(data: &[u8]) -> bool {
        data.len() >= 4 && data[..4] == Self::MAGIC
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn smb2_magic() {
        assert!(Smb2Header::is_smb2(&[0xFE, b'S', b'M', b'B', 0, 0]));
        assert!(!Smb2Header::is_smb2(&[0xFF, b'S', b'M', b'B']));
    }

    #[test]
    fn command_roundtrip() {
        assert_eq!(Smb2Command::from_u16(0x0000), Some(Smb2Command::Negotiate));
        assert_eq!(Smb2Command::from_u16(0x0008), Some(Smb2Command::Read));
        assert_eq!(Smb2Command::from_u16(0xFFFF), None);
    }

    #[test]
    fn dialect_ordering() {
        assert!(Smb2Dialect::Smb311 > Smb2Dialect::Smb300);
        assert!(Smb2Dialect::Smb202 < Smb2Dialect::Smb311);
    }
}
