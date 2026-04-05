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

/// Parse an SMB2 Negotiate Request from raw bytes.
///
/// Returns the list of dialects the client supports. Handles both SMB2 packets
/// with and without a NetBIOS session header, and falls back gracefully when
/// an SMB1 Negotiate is detected (returning `[Smb2Dialect::Smb202]`).
///
/// # Errors
///
/// Returns a static error string when the packet is too short, the magic bytes
/// are wrong, or the command is not `Negotiate`.
///
/// # Examples
///
/// ```
/// // An SMB1 negotiate packet triggers the SMB2 fallback path.
/// let smb1 = [0xFF, b'S', b'M', b'B', 0x72, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
///             0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
///             0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
///             0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
///             0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
///             0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
///             0, 0, 0, 0, 0, 0, 0, 0];
/// use signapps_smb_sysvol::protocol::parse_negotiate_request;
/// // actual usage requires a well-formed packet
/// ```
pub fn parse_negotiate_request(data: &[u8]) -> Result<Vec<Smb2Dialect>, &'static str> {
    // Minimum: 4 (NetBIOS) + 64 (SMB2 header) + 36 (negotiate body) = 104 bytes
    if data.len() < 100 {
        return Err("Data too short for SMB2 negotiate");
    }

    // Check for NetBIOS session header (optional, 4 bytes)
    let offset = if data[0] == 0x00 { 4 } else { 0 };
    let smb_data = &data[offset..];

    // Verify SMB2 magic
    if !Smb2Header::is_smb2(smb_data) {
        // Check for SMB1 negotiate (0xFF 'S' 'M' 'B')
        if smb_data.len() >= 4
            && smb_data[0] == 0xFF
            && smb_data[1] == b'S'
            && smb_data[2] == b'M'
            && smb_data[3] == b'B'
        {
            // SMB1 negotiate — respond with SMB2 negotiate
            return Ok(vec![Smb2Dialect::Smb202]);
        }
        return Err("Not an SMB2 message");
    }

    // Parse header to get command
    if smb_data.len() < 68 {
        return Err("SMB2 header too short");
    }

    let command = u16::from_le_bytes([smb_data[12], smb_data[13]]);
    if command != Smb2Command::Negotiate as u16 {
        return Err("Not a Negotiate command");
    }

    // Parse negotiate body (starts at offset 64)
    let body = &smb_data[64..];
    if body.len() < 36 {
        return Err("Negotiate body too short");
    }

    // StructureSize (2 bytes) = 36
    let dialect_count = u16::from_le_bytes([body[2], body[3]]) as usize;

    // Dialects start at offset 36 in the body
    let mut dialects = Vec::new();
    for i in 0..dialect_count {
        let off = 36 + i * 2;
        if off + 2 > body.len() {
            break;
        }
        let dialect_val = u16::from_le_bytes([body[off], body[off + 1]]);
        if let Some(d) = Smb2Dialect::from_u16(dialect_val) {
            dialects.push(d);
        }
    }

    Ok(dialects)
}

/// Build an SMB2 Negotiate Response.
///
/// Selects the highest dialect the server supports from the client's list and
/// returns a wire-format response including a NetBIOS session header and a
/// minimal (no security buffer) SMB2 Negotiate Response body.
///
/// # Examples
///
/// ```
/// use signapps_smb_sysvol::protocol::{build_negotiate_response, Smb2Dialect, Smb2Header};
/// let guid = [0u8; 16];
/// let resp = build_negotiate_response(&[Smb2Dialect::Smb300], &guid);
/// assert_eq!(resp[0], 0x00); // NetBIOS header
/// assert_eq!(&resp[4..8], &Smb2Header::MAGIC);
/// ```
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub fn build_negotiate_response(client_dialects: &[Smb2Dialect], server_guid: &[u8; 16]) -> Vec<u8> {
    // Select highest common dialect
    let selected = client_dialects.iter().max().copied().unwrap_or(Smb2Dialect::Smb202);

    let mut response = Vec::with_capacity(200);

    // NetBIOS session header (4 bytes) — length filled later
    response.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]);

    // SMB2 Header (64 bytes)
    response.extend_from_slice(&Smb2Header::MAGIC); // ProtocolId
    response.extend_from_slice(&64u16.to_le_bytes()); // StructureSize
    response.extend_from_slice(&0u16.to_le_bytes()); // CreditCharge
    response.extend_from_slice(&(NtStatus::Success as u32).to_le_bytes()); // Status
    response.extend_from_slice(&(Smb2Command::Negotiate as u16).to_le_bytes()); // Command
    response.extend_from_slice(&1u16.to_le_bytes()); // Credits granted
    response.extend_from_slice(&0x01u32.to_le_bytes()); // Flags (response)
    response.extend_from_slice(&0u32.to_le_bytes()); // NextCommand
    response.extend_from_slice(&0u64.to_le_bytes()); // MessageId
    response.extend_from_slice(&0u32.to_le_bytes()); // Reserved
    response.extend_from_slice(&0u32.to_le_bytes()); // TreeId
    response.extend_from_slice(&0u64.to_le_bytes()); // SessionId
    response.extend_from_slice(&[0u8; 16]); // Signature

    // SMB2 Negotiate Response Body (65 bytes)
    response.extend_from_slice(&65u16.to_le_bytes()); // StructureSize
    response.extend_from_slice(&1u16.to_le_bytes()); // SecurityMode (signing enabled)
    response.extend_from_slice(&(selected as u16).to_le_bytes()); // DialectRevision
    response.extend_from_slice(&0u16.to_le_bytes()); // NegotiateContextCount
    response.extend_from_slice(server_guid); // ServerGuid (16 bytes)
    response.extend_from_slice(&0x07u32.to_le_bytes()); // Capabilities (DFS | Leasing | LargeFiles)
    response.extend_from_slice(&1_048_576u32.to_le_bytes()); // MaxTransactSize (1MB)
    response.extend_from_slice(&1_048_576u32.to_le_bytes()); // MaxReadSize (1MB)
    response.extend_from_slice(&1_048_576u32.to_le_bytes()); // MaxWriteSize (1MB)
    // SystemTime (8 bytes) — Windows FILETIME
    let now_filetime =
        chrono::Utc::now().timestamp() as u64 * 10_000_000 + 116_444_736_000_000_000;
    response.extend_from_slice(&now_filetime.to_le_bytes());
    // ServerStartTime (8 bytes)
    response.extend_from_slice(&0u64.to_le_bytes());
    // SecurityBufferOffset (2 bytes) + SecurityBufferLength (2 bytes)
    let sec_offset = (64 + 65) as u16; // header + body
    response.extend_from_slice(&sec_offset.to_le_bytes());
    response.extend_from_slice(&0u16.to_le_bytes()); // No security buffer
    // NegotiateContextOffset (4 bytes)
    response.extend_from_slice(&0u32.to_le_bytes());

    // Fix NetBIOS length (total - 4 bytes header)
    let total_len = (response.len() - 4) as u32;
    response[1] = ((total_len >> 16) & 0xFF) as u8;
    response[2] = ((total_len >> 8) & 0xFF) as u8;
    response[3] = (total_len & 0xFF) as u8;

    response
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

    #[test]
    fn build_negotiate_response_valid() {
        let guid = [0x42u8; 16];
        let dialects = vec![Smb2Dialect::Smb202, Smb2Dialect::Smb311];
        let resp = build_negotiate_response(&dialects, &guid);
        // Should start with NetBIOS header
        assert_eq!(resp[0], 0x00);
        // Should contain SMB2 magic after NetBIOS header
        assert_eq!(&resp[4..8], &Smb2Header::MAGIC);
        // Should select highest dialect (0x0311)
        assert_eq!(u16::from_le_bytes([resp[4 + 64 + 4], resp[4 + 64 + 5]]), 0x0311);
    }

    #[test]
    fn negotiate_response_has_correct_length() {
        let guid = [0u8; 16];
        let resp = build_negotiate_response(&[Smb2Dialect::Smb300], &guid);
        let netbios_len =
            ((resp[1] as u32) << 16) | ((resp[2] as u32) << 8) | (resp[3] as u32);
        assert_eq!(netbios_len as usize, resp.len() - 4);
    }
}
