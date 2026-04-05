//! DHCP server types and lease management.
//!
//! Implements DHCP Discover/Offer/Request/Acknowledge flow
//! with integration to DNS (dynamic updates) and PXE (boot options).

use chrono::Utc;
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

/// DHCP message types (RFC 2131).
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DhcpMessageType {
    Discover = 1,
    Offer = 2,
    Request = 3,
    Decline = 4,
    Ack = 5,
    Nak = 6,
    Release = 7,
    Inform = 8,
}

impl DhcpMessageType {
    /// Parse a DHCP message type from its wire encoding.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_dns_server::dhcp::DhcpMessageType;
    /// assert_eq!(DhcpMessageType::from_u8(1), Some(DhcpMessageType::Discover));
    /// assert_eq!(DhcpMessageType::from_u8(99), None);
    /// ```
    pub fn from_u8(val: u8) -> Option<Self> {
        match val {
            1 => Some(Self::Discover),
            2 => Some(Self::Offer),
            3 => Some(Self::Request),
            4 => Some(Self::Decline),
            5 => Some(Self::Ack),
            6 => Some(Self::Nak),
            7 => Some(Self::Release),
            8 => Some(Self::Inform),
            _ => None,
        }
    }
}

/// A parsed DHCP packet (simplified).
#[derive(Debug, Clone)]
pub struct DhcpPacket {
    /// Operation code: 1 = request, 2 = reply.
    pub op: u8,
    /// Transaction ID — echoed in the server reply.
    pub xid: u32,
    /// Client hardware (MAC) address.
    pub mac_address: [u8; 6],
    /// IP address requested by the client (option 50).
    pub requested_ip: Option<[u8; 4]>,
    /// DHCP message type (option 53).
    pub message_type: DhcpMessageType,
    /// Hostname supplied by the client (option 12).
    pub hostname: Option<String>,
    /// Parameter request list (option 55).
    pub parameter_list: Vec<u8>,
}

/// Result of processing a DHCP request.
#[derive(Debug, Clone, Serialize)]
pub struct DhcpResponse {
    /// Message type to include in the reply (e.g. 2 = OFFER, 5 = ACK).
    pub message_type: u8,
    /// IP address offered/acknowledged for the client.
    pub offered_ip: [u8; 4],
    /// Subnet mask (option 1).
    pub subnet_mask: [u8; 4],
    /// Default gateway (option 3).
    pub gateway: [u8; 4],
    /// DNS server list (option 6).
    pub dns_servers: Vec<[u8; 4]>,
    /// NTP server list (option 42).
    pub ntp_servers: Vec<[u8; 4]>,
    /// Domain name for the client (option 15).
    pub domain_name: String,
    /// Lease duration in seconds (option 51).
    pub lease_seconds: u32,
    /// PXE boot server hostname/IP (option 66), if PXE is enabled.
    pub pxe_server: Option<String>,
    /// PXE boot filename (option 67), if PXE is enabled.
    pub pxe_bootfile: Option<String>,
}

/// Allocate an IP address from a DHCP scope.
///
/// Resolution order:
/// 1. Static reservation by MAC address.
/// 2. Existing active lease for this MAC.
/// 3. First unused IP in the scope's range.
///
/// # Errors
///
/// Returns `signapps_common::Error::NotFound` when the scope does not exist,
/// and `signapps_common::Error::Internal` when the scope is exhausted.
#[tracing::instrument(skip(pool))]
pub async fn allocate_ip(
    pool: &PgPool,
    scope_id: Uuid,
    mac_address: &str,
) -> signapps_common::Result<String> {
    // 1. Check reservation first
    let reservation: Option<(String,)> = sqlx::query_as(
        "SELECT ip_address FROM infrastructure.dhcp_reservations \
         WHERE scope_id = $1 AND mac_address = $2",
    )
    .bind(scope_id)
    .bind(mac_address)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    if let Some((ip,)) = reservation {
        return Ok(ip);
    }

    // 2. Check existing active lease
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT ip_address FROM infrastructure.dhcp_leases \
         WHERE scope_id = $1 AND mac_address = $2 AND is_active = true",
    )
    .bind(scope_id)
    .bind(mac_address)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    if let Some((ip,)) = existing {
        return Ok(ip);
    }

    // 3. Find scope range and scan for first unused IP
    let scope: Option<(String, String)> = sqlx::query_as(
        "SELECT range_start, range_end FROM infrastructure.dhcp_scopes WHERE id = $1",
    )
    .bind(scope_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let (start, end) =
        scope.ok_or_else(|| signapps_common::Error::NotFound("Scope not found".into()))?;

    let start_num = ip_to_u32(&start);
    let end_num = ip_to_u32(&end);

    let used_ips: Vec<(String,)> = sqlx::query_as(
        "SELECT ip_address FROM infrastructure.dhcp_leases \
         WHERE scope_id = $1 AND is_active = true",
    )
    .bind(scope_id)
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let used_set: std::collections::HashSet<u32> =
        used_ips.iter().map(|(ip,)| ip_to_u32(ip)).collect();

    for ip_num in start_num..=end_num {
        if !used_set.contains(&ip_num) {
            return Ok(u32_to_ip(ip_num));
        }
    }

    Err(signapps_common::Error::Internal(
        "No available IP addresses in scope".into(),
    ))
}

/// Create or renew a DHCP lease record.
///
/// Uses an upsert so that re-requesting the same `(scope_id, ip_address)` pair
/// refreshes the lease rather than failing.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` on SQL failure.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool))]
pub async fn create_lease(
    pool: &PgPool,
    scope_id: Uuid,
    ip_address: &str,
    mac_address: &str,
    hostname: Option<&str>,
    computer_id: Option<Uuid>,
    duration_hours: i32,
) -> signapps_common::Result<()> {
    let now = Utc::now();
    let lease_end = now + chrono::Duration::hours(duration_hours as i64);

    sqlx::query(
        r#"
        INSERT INTO infrastructure.dhcp_leases
            (scope_id, ip_address, mac_address, hostname, computer_id, lease_start, lease_end, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        ON CONFLICT (scope_id, ip_address) DO UPDATE SET
            mac_address  = EXCLUDED.mac_address,
            hostname     = EXCLUDED.hostname,
            lease_start  = EXCLUDED.lease_start,
            lease_end    = EXCLUDED.lease_end,
            is_active    = true
        "#,
    )
    .bind(scope_id)
    .bind(ip_address)
    .bind(mac_address)
    .bind(hostname)
    .bind(computer_id)
    .bind(now)
    .bind(lease_end)
    .execute(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    tracing::info!(ip = ip_address, mac = mac_address, "DHCP lease created");
    Ok(())
}

/// Parse an IPv4 address string to a `u32` (network byte order).
fn ip_to_u32(ip: &str) -> u32 {
    let parts: Vec<u32> = ip.split('.').filter_map(|p| p.parse().ok()).collect();
    if parts.len() == 4 {
        (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]
    } else {
        0
    }
}

/// Convert a `u32` back to a dotted-decimal IPv4 address string.
fn u32_to_ip(num: u32) -> String {
    format!(
        "{}.{}.{}.{}",
        (num >> 24) & 0xFF,
        (num >> 16) & 0xFF,
        (num >> 8) & 0xFF,
        num & 0xFF,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ip_roundtrip() {
        assert_eq!(u32_to_ip(ip_to_u32("192.168.1.100")), "192.168.1.100");
        assert_eq!(u32_to_ip(ip_to_u32("10.0.0.1")), "10.0.0.1");
        assert_eq!(u32_to_ip(ip_to_u32("255.255.255.255")), "255.255.255.255");
    }

    #[test]
    fn ip_range_iteration() {
        let start = ip_to_u32("192.168.1.100");
        let end = ip_to_u32("192.168.1.105");
        let count = (end - start + 1) as usize;
        assert_eq!(count, 6);
    }

    #[test]
    fn dhcp_message_type_parse() {
        assert_eq!(DhcpMessageType::from_u8(1), Some(DhcpMessageType::Discover));
        assert_eq!(DhcpMessageType::from_u8(5), Some(DhcpMessageType::Ack));
        assert_eq!(DhcpMessageType::from_u8(99), None);
    }
}
