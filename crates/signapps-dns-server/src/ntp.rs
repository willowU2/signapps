//! NTP server types and time synchronization.
//!
//! Provides basic NTP server functionality for network time synchronization.
//! Listens on UDP 123 and responds with current server time.

use serde::{Deserialize, Serialize};

/// NTP server configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NtpConfig {
    /// Whether the embedded NTP server is active.
    pub enabled: bool,
    /// Upstream NTP servers used for time synchronization.
    pub upstream_servers: Vec<String>,
    /// Stratum level advertised to clients (1 = primary, 2–15 = secondary).
    pub stratum: u8,
    /// Maximum acceptable clock drift in milliseconds before resync.
    pub max_drift_ms: u64,
}

impl Default for NtpConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            upstream_servers: vec!["pool.ntp.org".to_string(), "time.google.com".to_string()],
            stratum: 3,
            max_drift_ms: 500,
        }
    }
}

/// NTP packet (simplified, RFC 5905).
///
/// A full NTP packet is 48 bytes. We implement the minimum required
/// to respond to NTP clients with the current server time.
///
/// # Examples
///
/// ```
/// use signapps_dns_server::ntp::NtpPacket;
/// let resp = NtpPacket::server_response(0, 3);
/// let bytes = resp.to_bytes();
/// assert_eq!(bytes.len(), 48);
/// ```
#[derive(Debug, Clone)]
pub struct NtpPacket {
    /// Combined leap indicator, version number, and mode byte.
    pub li_vn_mode: u8,
    /// Clock stratum of the server.
    pub stratum: u8,
    /// Maximum interval between successive messages (log2 seconds).
    pub poll: i8,
    /// Precision of the local clock (log2 seconds).
    pub precision: i8,
    /// Round-trip delay to the reference clock (NTP short format).
    pub root_delay: u32,
    /// Maximum error relative to the reference clock (NTP short format).
    pub root_dispersion: u32,
    /// Reference clock identifier (e.g. `NTPS` for this server).
    pub reference_id: u32,
    /// Time when the local clock was last updated (NTP timestamp format).
    pub reference_timestamp: u64,
    /// Time at which the request departed the client (echoed from client).
    pub origin_timestamp: u64,
    /// Time at which the request arrived at the server.
    pub receive_timestamp: u64,
    /// Time at which the reply departed the server.
    pub transmit_timestamp: u64,
}

impl NtpPacket {
    /// NTP epoch offset from Unix epoch (1900-01-01 to 1970-01-01 = 70 years).
    const NTP_EPOCH_OFFSET: u64 = 2_208_988_800;

    /// Build a server response packet for the given client transmit timestamp.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_dns_server::ntp::NtpPacket;
    /// let pkt = NtpPacket::server_response(0, 3);
    /// assert_eq!(pkt.stratum, 3);
    /// ```
    pub fn server_response(client_transmit: u64, stratum: u8) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default();

        let ntp_secs = now.as_secs() + Self::NTP_EPOCH_OFFSET;
        // Fixed-point fraction: subsec_nanos * 2^32 / 1e9
        let ntp_frac = (now.subsec_nanos() as u64 * (1u64 << 32)) / 1_000_000_000;
        let ntp_timestamp = (ntp_secs << 32) | ntp_frac;

        Self {
            li_vn_mode: 0x24, // LI=0 (no warning), VN=4, Mode=4 (server)
            stratum,
            poll: 6,
            precision: -20, // ~1 microsecond
            root_delay: 0,
            root_dispersion: 0,
            reference_id: 0x4E54_5053, // ASCII "NTPS"
            reference_timestamp: ntp_timestamp,
            origin_timestamp: client_transmit,
            receive_timestamp: ntp_timestamp,
            transmit_timestamp: ntp_timestamp,
        }
    }

    /// Parse an NTP packet from a 48-byte buffer.
    ///
    /// Returns `None` if the buffer is shorter than 48 bytes.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_dns_server::ntp::NtpPacket;
    /// assert!(NtpPacket::from_bytes(&[0u8; 10]).is_none());
    /// assert!(NtpPacket::from_bytes(&[0u8; 48]).is_some());
    /// ```
    ///
    /// # Errors
    ///
    /// This function does not return an error; it returns `None` on invalid input.
    ///
    /// # Panics
    ///
    /// No panics — bounds are checked before all slice operations.
    pub fn from_bytes(data: &[u8]) -> Option<Self> {
        if data.len() < 48 {
            return None;
        }

        Some(Self {
            li_vn_mode: data[0],
            stratum: data[1],
            poll: data[2] as i8,
            precision: data[3] as i8,
            root_delay: u32::from_be_bytes([data[4], data[5], data[6], data[7]]),
            root_dispersion: u32::from_be_bytes([data[8], data[9], data[10], data[11]]),
            reference_id: u32::from_be_bytes([data[12], data[13], data[14], data[15]]),
            reference_timestamp: u64::from_be_bytes([
                data[16], data[17], data[18], data[19], data[20], data[21], data[22], data[23],
            ]),
            origin_timestamp: u64::from_be_bytes([
                data[24], data[25], data[26], data[27], data[28], data[29], data[30], data[31],
            ]),
            receive_timestamp: u64::from_be_bytes([
                data[32], data[33], data[34], data[35], data[36], data[37], data[38], data[39],
            ]),
            transmit_timestamp: u64::from_be_bytes([
                data[40], data[41], data[42], data[43], data[44], data[45], data[46], data[47],
            ]),
        })
    }

    /// Serialize the packet to a 48-byte wire buffer.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_dns_server::ntp::NtpPacket;
    /// let pkt = NtpPacket::server_response(0, 3);
    /// assert_eq!(pkt.to_bytes().len(), 48);
    /// ```
    ///
    /// # Panics
    ///
    /// No panics — the output buffer is always exactly 48 bytes.
    pub fn to_bytes(&self) -> [u8; 48] {
        let mut buf = [0u8; 48];
        buf[0] = self.li_vn_mode;
        buf[1] = self.stratum;
        buf[2] = self.poll as u8;
        buf[3] = self.precision as u8;
        buf[4..8].copy_from_slice(&self.root_delay.to_be_bytes());
        buf[8..12].copy_from_slice(&self.root_dispersion.to_be_bytes());
        buf[12..16].copy_from_slice(&self.reference_id.to_be_bytes());
        buf[16..24].copy_from_slice(&self.reference_timestamp.to_be_bytes());
        buf[24..32].copy_from_slice(&self.origin_timestamp.to_be_bytes());
        buf[32..40].copy_from_slice(&self.receive_timestamp.to_be_bytes());
        buf[40..48].copy_from_slice(&self.transmit_timestamp.to_be_bytes());
        buf
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ntp_packet_roundtrip() {
        let resp = NtpPacket::server_response(0, 3);
        let bytes = resp.to_bytes();
        assert_eq!(bytes.len(), 48);
        let parsed = NtpPacket::from_bytes(&bytes).unwrap();
        assert_eq!(parsed.stratum, 3);
        assert_eq!(parsed.li_vn_mode, 0x24);
    }

    #[test]
    fn ntp_default_config() {
        let cfg = NtpConfig::default();
        assert!(cfg.enabled);
        assert_eq!(cfg.stratum, 3);
        assert!(!cfg.upstream_servers.is_empty());
    }

    #[test]
    fn ntp_packet_parse_short() {
        assert!(NtpPacket::from_bytes(&[0; 10]).is_none());
        assert!(NtpPacket::from_bytes(&[0; 48]).is_some());
    }
}
