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

/// Parse an SMB2 Session Setup Request.
///
/// Returns the security blob (SPNEGO token) if present.
///
/// # Errors
///
/// Returns a static error string when the packet is not a valid SMB2 Session
/// Setup request (wrong magic, wrong command, or body too short).
///
/// # Examples
///
/// ```
/// use signapps_smb_sysvol::protocol::parse_session_setup_request;
/// // A real packet would come from a Windows SMB client.
/// ```
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub fn parse_session_setup_request(data: &[u8]) -> Result<SessionSetupInfo, &'static str> {
    let offset = if data.len() > 4 && data[0] == 0x00 { 4 } else { 0 };
    let smb = &data[offset..];

    if !Smb2Header::is_smb2(smb) || smb.len() < 64 {
        return Err("Not an SMB2 message");
    }

    let command = u16::from_le_bytes([smb[12], smb[13]]);
    if command != Smb2Command::SessionSetup as u16 {
        return Err("Not a Session Setup command");
    }

    let message_id = u64::from_le_bytes(smb[24..32].try_into().unwrap_or([0; 8]));

    // Session Setup body starts at offset 64
    let body = &smb[64..];
    if body.len() < 24 {
        return Err("Session Setup body too short");
    }

    // SecurityBufferOffset (from start of SMB2 header) and Length
    let sec_offset = u16::from_le_bytes([body[12], body[13]]) as usize;
    let sec_length = u16::from_le_bytes([body[14], body[15]]) as usize;

    let security_blob = if sec_length > 0 && sec_offset >= 64 {
        let blob_start = sec_offset - 64; // relative to body
        if blob_start + sec_length <= body.len() {
            Some(body[blob_start..blob_start + sec_length].to_vec())
        } else {
            None
        }
    } else {
        None
    };

    Ok(SessionSetupInfo {
        message_id,
        security_blob,
    })
}

/// Info extracted from Session Setup request.
#[derive(Debug)]
pub struct SessionSetupInfo {
    /// Message identifier from the SMB2 header.
    pub message_id: u64,
    /// SPNEGO security blob, if present.
    pub security_blob: Option<Vec<u8>>,
}

/// Build an SMB2 Session Setup Response.
///
/// For now, return `STATUS_MORE_PROCESSING_REQUIRED` to indicate
/// the auth handshake is not complete (multi-step SPNEGO).
///
/// # Examples
///
/// ```
/// use signapps_smb_sysvol::protocol::{build_session_setup_response, NtStatus, Smb2Header};
/// let resp = build_session_setup_response(1, 0x1234, NtStatus::MoreProcessingRequired);
/// assert_eq!(&resp[4..8], &Smb2Header::MAGIC);
/// ```
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub fn build_session_setup_response(
    message_id: u64,
    session_id: u64,
    status: NtStatus,
) -> Vec<u8> {
    let mut response = Vec::with_capacity(140);

    // NetBIOS header
    response.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]);

    // SMB2 Header (64 bytes)
    response.extend_from_slice(&Smb2Header::MAGIC);
    response.extend_from_slice(&64u16.to_le_bytes()); // StructureSize
    response.extend_from_slice(&0u16.to_le_bytes()); // CreditCharge
    response.extend_from_slice(&(status as u32).to_le_bytes());
    response.extend_from_slice(&(Smb2Command::SessionSetup as u16).to_le_bytes());
    response.extend_from_slice(&1u16.to_le_bytes()); // Credits
    response.extend_from_slice(&0x01u32.to_le_bytes()); // Flags (response)
    response.extend_from_slice(&0u32.to_le_bytes()); // NextCommand
    response.extend_from_slice(&message_id.to_le_bytes());
    response.extend_from_slice(&0u32.to_le_bytes()); // Reserved
    response.extend_from_slice(&0u32.to_le_bytes()); // TreeId
    response.extend_from_slice(&session_id.to_le_bytes());
    response.extend_from_slice(&[0u8; 16]); // Signature

    // Session Setup Response body (9 bytes minimum)
    response.extend_from_slice(&9u16.to_le_bytes()); // StructureSize
    response.extend_from_slice(&0u16.to_le_bytes()); // SessionFlags
    // SecurityBufferOffset + Length
    response.extend_from_slice(&((64 + 9) as u16).to_le_bytes());
    response.extend_from_slice(&0u16.to_le_bytes()); // No security blob
    response.push(0); // Padding to reach 9 bytes body

    // Fix NetBIOS length
    let total = (response.len() - 4) as u32;
    response[1] = ((total >> 16) & 0xFF) as u8;
    response[2] = ((total >> 8) & 0xFF) as u8;
    response[3] = (total & 0xFF) as u8;

    response
}

/// Parse an SMB2 Tree Connect Request.
///
/// Extracts the UNC share path (UTF-16LE encoded) and the message/session
/// identifiers from the SMB2 header so the caller can decide whether to
/// grant or reject access to the requested share.
///
/// # Errors
///
/// Returns a static error string when the packet is not a valid SMB2 Tree
/// Connect request (wrong magic, wrong command, or body too short).
///
/// # Examples
///
/// ```
/// // A real packet would come from a Windows SMB client.
/// use signapps_smb_sysvol::protocol::parse_tree_connect_request;
/// ```
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub fn parse_tree_connect_request(data: &[u8]) -> Result<TreeConnectInfo, &'static str> {
    let offset = if data.len() > 4 && data[0] == 0x00 { 4 } else { 0 };
    let smb = &data[offset..];

    if !Smb2Header::is_smb2(smb) || smb.len() < 64 {
        return Err("Not SMB2");
    }

    let command = u16::from_le_bytes([smb[12], smb[13]]);
    if command != Smb2Command::TreeConnect as u16 {
        return Err("Not TreeConnect");
    }

    let message_id = u64::from_le_bytes(smb[24..32].try_into().unwrap_or([0; 8]));
    let session_id = u64::from_le_bytes(smb[40..48].try_into().unwrap_or([0; 8]));

    let body = &smb[64..];
    if body.len() < 8 {
        return Err("TreeConnect body too short");
    }

    let path_offset = u16::from_le_bytes([body[4], body[5]]) as usize;
    let path_length = u16::from_le_bytes([body[6], body[7]]) as usize;

    let path = if path_offset >= 64 && path_length > 0 {
        let start = path_offset - 64;
        if start + path_length <= body.len() {
            // UTF-16LE encoded path
            let utf16: Vec<u16> = body[start..start + path_length]
                .chunks(2)
                .map(|c| u16::from_le_bytes([c[0], c.get(1).copied().unwrap_or(0)]))
                .collect();
            String::from_utf16_lossy(&utf16)
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    Ok(TreeConnectInfo { message_id, session_id, path })
}

/// Info extracted from a Tree Connect request.
#[derive(Debug)]
pub struct TreeConnectInfo {
    /// Message identifier from the SMB2 header.
    pub message_id: u64,
    /// Session identifier from the SMB2 header.
    pub session_id: u64,
    /// UNC share path requested by the client (e.g. `\\server\SYSVOL`).
    pub path: String,
}

/// Build an SMB2 Tree Connect Response.
///
/// Returns a wire-format response granting or denying access to the
/// requested share.  `share_type` should be `0x01` for a disk share.
///
/// # Examples
///
/// ```
/// use signapps_smb_sysvol::protocol::{build_tree_connect_response, NtStatus, Smb2Header};
/// let resp = build_tree_connect_response(1, 0x1234, 1, 0x01, NtStatus::Success);
/// assert_eq!(&resp[4..8], &Smb2Header::MAGIC);
/// ```
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub fn build_tree_connect_response(
    message_id: u64,
    session_id: u64,
    tree_id: u32,
    share_type: u8, // 0x01 = disk
    status: NtStatus,
) -> Vec<u8> {
    let mut resp = Vec::with_capacity(140);

    // NetBIOS header
    resp.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]);

    // SMB2 Header (64 bytes)
    resp.extend_from_slice(&Smb2Header::MAGIC);
    resp.extend_from_slice(&64u16.to_le_bytes()); // StructureSize
    resp.extend_from_slice(&0u16.to_le_bytes()); // CreditCharge
    resp.extend_from_slice(&(status as u32).to_le_bytes());
    resp.extend_from_slice(&(Smb2Command::TreeConnect as u16).to_le_bytes());
    resp.extend_from_slice(&1u16.to_le_bytes()); // Credits
    resp.extend_from_slice(&0x01u32.to_le_bytes()); // Flags (response)
    resp.extend_from_slice(&0u32.to_le_bytes()); // NextCommand
    resp.extend_from_slice(&message_id.to_le_bytes());
    resp.extend_from_slice(&0u32.to_le_bytes()); // Reserved
    resp.extend_from_slice(&tree_id.to_le_bytes());
    resp.extend_from_slice(&session_id.to_le_bytes());
    resp.extend_from_slice(&[0u8; 16]); // Signature

    // TreeConnect Response Body (16 bytes)
    resp.extend_from_slice(&16u16.to_le_bytes()); // StructureSize
    resp.push(share_type); // ShareType (0x01 = Disk)
    resp.push(0); // Reserved
    resp.extend_from_slice(&0x30u32.to_le_bytes()); // ShareFlags (DFS | RESTRICT_EXCLUSIVE_OPENS)
    resp.extend_from_slice(&0x1Fu32.to_le_bytes()); // Capabilities (all file caps)
    resp.extend_from_slice(&0x001F_01FFu32.to_le_bytes()); // MaximalAccess (full)

    // Fix NetBIOS length
    let total = (resp.len() - 4) as u32;
    resp[1] = ((total >> 16) & 0xFF) as u8;
    resp[2] = ((total >> 8) & 0xFF) as u8;
    resp[3] = (total & 0xFF) as u8;

    resp
}

// ── SMB2 Create (Open File / Directory) ──────────────────────────────────────

/// Info extracted from an SMB2 Create Request.
#[derive(Debug)]
pub struct CreateInfo {
    /// Message identifier from the SMB2 header.
    pub message_id: u64,
    /// Session identifier from the SMB2 header.
    pub session_id: u64,
    /// Tree identifier from the SMB2 header.
    pub tree_id: u32,
    /// Requested file or directory name (UTF-16LE decoded).
    pub filename: String,
}

/// Parse an SMB2 Create (Open File) Request.
///
/// Extracts the `MessageId`, `SessionId`, `TreeId`, and `FileName` (UTF-16LE
/// decoded) from the wire packet.  Handles both bare SMB2 packets and packets
/// preceded by a 4-byte NetBIOS session header.
///
/// # Errors
///
/// Returns a static error string if the packet is too short, the magic bytes
/// are wrong, or the command code is not `Create` (0x0005).
///
/// # Examples
///
/// ```
/// use signapps_smb_sysvol::protocol::{build_create_response, NtStatus, Smb2Header};
/// let file_id = [0x42u8; 16];
/// let resp = build_create_response(1, 0x1234, 1, file_id, NtStatus::Success);
/// assert_eq!(&resp[4..8], &Smb2Header::MAGIC);
/// ```
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub fn parse_create_request(data: &[u8]) -> Result<CreateInfo, &'static str> {
    let offset = if data.len() > 4 && data[0] == 0x00 { 4 } else { 0 };
    let smb = &data[offset..];

    if !Smb2Header::is_smb2(smb) || smb.len() < 64 {
        return Err("Not SMB2");
    }

    let command = u16::from_le_bytes([smb[12], smb[13]]);
    if command != Smb2Command::Create as u16 {
        return Err("Not Create");
    }

    let message_id = u64::from_le_bytes(smb[24..32].try_into().unwrap_or([0; 8]));
    let session_id = u64::from_le_bytes(smb[40..48].try_into().unwrap_or([0; 8]));
    let tree_id = u32::from_le_bytes(smb[36..40].try_into().unwrap_or([0; 4]));

    let body = &smb[64..];
    if body.len() < 56 {
        return Err("Create body too short");
    }

    // FileName is at NameOffset/NameLength (offsets 44–47 within the body,
    // but the spec measures NameOffset from the start of the SMB2 header,
    // so we subtract 64 to get the position within `body`).
    let name_offset = u16::from_le_bytes([body[44], body[45]]) as usize;
    let name_length = u16::from_le_bytes([body[46], body[47]]) as usize;

    let filename = if name_offset >= 64 && name_length > 0 {
        let start = name_offset - 64;
        if start + name_length <= body.len() {
            let utf16: Vec<u16> = body[start..start + name_length]
                .chunks(2)
                .map(|c| u16::from_le_bytes([c[0], c.get(1).copied().unwrap_or(0)]))
                .collect();
            String::from_utf16_lossy(&utf16).to_owned()
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    Ok(CreateInfo { message_id, session_id, tree_id, filename })
}

/// Build an SMB2 Create Response (file or directory opened successfully).
///
/// Returns a wire-format response with a NetBIOS session header, an SMB2
/// response header, and a minimal Create Response body with the supplied
/// opaque `file_id` (16-byte handle).
///
/// `status` should be [`NtStatus::Success`] for a successful open.
///
/// # Examples
///
/// ```
/// use signapps_smb_sysvol::protocol::{build_create_response, NtStatus, Smb2Header};
/// let file_id = [0x42u8; 16];
/// let resp = build_create_response(1, 0x1234, 1, file_id, NtStatus::Success);
/// // NetBIOS header byte
/// assert_eq!(resp[0], 0x00);
/// // SMB2 magic
/// assert_eq!(&resp[4..8], &Smb2Header::MAGIC);
/// // NT Status = Success
/// let status = u32::from_le_bytes([resp[12], resp[13], resp[14], resp[15]]);
/// assert_eq!(status, NtStatus::Success as u32);
/// ```
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub fn build_create_response(
    message_id: u64,
    session_id: u64,
    tree_id: u32,
    file_id: [u8; 16],
    status: NtStatus,
) -> Vec<u8> {
    let mut resp = Vec::with_capacity(200);

    // NetBIOS session header (length filled below)
    resp.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]);

    // SMB2 Header (64 bytes)
    resp.extend_from_slice(&Smb2Header::MAGIC);
    resp.extend_from_slice(&64u16.to_le_bytes()); // StructureSize
    resp.extend_from_slice(&0u16.to_le_bytes()); // CreditCharge
    resp.extend_from_slice(&(status as u32).to_le_bytes()); // Status
    resp.extend_from_slice(&(Smb2Command::Create as u16).to_le_bytes()); // Command
    resp.extend_from_slice(&1u16.to_le_bytes()); // Credits granted
    resp.extend_from_slice(&0x01u32.to_le_bytes()); // Flags (response)
    resp.extend_from_slice(&0u32.to_le_bytes()); // NextCommand
    resp.extend_from_slice(&message_id.to_le_bytes());
    resp.extend_from_slice(&0u32.to_le_bytes()); // Reserved
    resp.extend_from_slice(&tree_id.to_le_bytes());
    resp.extend_from_slice(&session_id.to_le_bytes());
    resp.extend_from_slice(&[0u8; 16]); // Signature

    // Create Response Body (MS-SMB2 §2.2.14)
    resp.extend_from_slice(&89u16.to_le_bytes()); // StructureSize (fixed)
    resp.push(0); // OplockLevel (SMB2_OPLOCK_LEVEL_NONE)
    resp.push(0); // Flags
    resp.extend_from_slice(&0x01u32.to_le_bytes()); // CreateAction (FILE_OPENED)
    resp.extend_from_slice(&0u64.to_le_bytes()); // CreationTime
    resp.extend_from_slice(&0u64.to_le_bytes()); // LastAccessTime
    resp.extend_from_slice(&0u64.to_le_bytes()); // LastWriteTime
    resp.extend_from_slice(&0u64.to_le_bytes()); // ChangeTime
    resp.extend_from_slice(&0u64.to_le_bytes()); // AllocationSize
    resp.extend_from_slice(&0u64.to_le_bytes()); // EndOfFile
    resp.extend_from_slice(&0x10u32.to_le_bytes()); // FileAttributes (FILE_ATTRIBUTE_DIRECTORY)
    resp.extend_from_slice(&0u32.to_le_bytes()); // Reserved2
    resp.extend_from_slice(&file_id); // FileId (16-byte opaque handle)
    resp.extend_from_slice(&0u32.to_le_bytes()); // CreateContextsOffset
    resp.extend_from_slice(&0u32.to_le_bytes()); // CreateContextsLength
    resp.push(0); // Padding (body = 89 bytes)

    // Fix NetBIOS session length (total - 4 header bytes)
    let total = (resp.len() - 4) as u32;
    resp[1] = ((total >> 16) & 0xFF) as u8;
    resp[2] = ((total >> 8) & 0xFF) as u8;
    resp[3] = (total & 0xFF) as u8;

    resp
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

    #[test]
    fn session_setup_response_valid() {
        let resp = build_session_setup_response(1, 0x1234, NtStatus::MoreProcessingRequired);
        assert_eq!(&resp[4..8], &Smb2Header::MAGIC);
        // Check status = MoreProcessingRequired (at bytes 12..16 of SMB2 header, i.e. resp[16..20])
        let status = u32::from_le_bytes([resp[12], resp[13], resp[14], resp[15]]);
        assert_eq!(status, NtStatus::MoreProcessingRequired as u32);
    }

    #[test]
    fn session_setup_response_netbios_length() {
        let resp = build_session_setup_response(2, 0x5678, NtStatus::MoreProcessingRequired);
        let netbios_len =
            ((resp[1] as u32) << 16) | ((resp[2] as u32) << 8) | (resp[3] as u32);
        assert_eq!(netbios_len as usize, resp.len() - 4);
    }

    #[test]
    fn tree_connect_response_valid() {
        let resp = build_tree_connect_response(1, 0x1234, 1, 0x01, NtStatus::Success);
        assert_eq!(&resp[4..8], &Smb2Header::MAGIC);
        let status = u32::from_le_bytes([resp[12], resp[13], resp[14], resp[15]]);
        assert_eq!(status, NtStatus::Success as u32);
    }

    #[test]
    fn tree_connect_bad_share() {
        let resp = build_tree_connect_response(1, 0, 0, 0x01, NtStatus::BadNetworkName);
        let status = u32::from_le_bytes([resp[12], resp[13], resp[14], resp[15]]);
        assert_eq!(status, NtStatus::BadNetworkName as u32);
    }

    #[test]
    fn create_response_valid() {
        let file_id = [0x42u8; 16];
        let resp = build_create_response(1, 0x1234, 1, file_id, NtStatus::Success);
        // Must start with NetBIOS header
        assert_eq!(resp[0], 0x00);
        // SMB2 magic at offset 4
        assert_eq!(&resp[4..8], &Smb2Header::MAGIC);
        // NT Status = Success
        let status = u32::from_le_bytes([resp[12], resp[13], resp[14], resp[15]]);
        assert_eq!(status, NtStatus::Success as u32);
        // Command = Create (0x0005)
        let command = u16::from_le_bytes([resp[16], resp[17]]);
        assert_eq!(command, Smb2Command::Create as u16);
    }

    #[test]
    fn create_response_netbios_length() {
        let file_id = [0u8; 16];
        let resp = build_create_response(99, 0, 0, file_id, NtStatus::Success);
        let netbios_len =
            ((resp[1] as u32) << 16) | ((resp[2] as u32) << 8) | (resp[3] as u32);
        assert_eq!(netbios_len as usize, resp.len() - 4);
    }

    #[test]
    fn create_response_file_id_embedded() {
        let file_id = [0xABu8; 16];
        let resp = build_create_response(1, 1, 1, file_id, NtStatus::Success);
        // FileId is at offset 4 (NetBIOS) + 64 (SMB2 header) + 32 (body before FileId)
        // Body layout: StructureSize(2) + OplockLevel(1) + Flags(1) + CreateAction(4)
        //   + CreationTime(8) + LastAccessTime(8) + LastWriteTime(8) + ChangeTime(8)
        //   + AllocationSize(8) + EndOfFile(8) + FileAttributes(4) + Reserved2(4) = 64 bytes
        // Hmm, that's 2+1+1+4+8+8+8+8+8+8+4+4 = 64 but FileId comes next at +64.
        // offset = 4 + 64 + 2 + 2 + 4 + 8*6 + 4 + 4 = 4+64+60 = 128
        let file_id_start = 4 + 64 + 2 + 1 + 1 + 4 + 8 + 8 + 8 + 8 + 8 + 8 + 4 + 4;
        assert_eq!(&resp[file_id_start..file_id_start + 16], &file_id);
    }
}
