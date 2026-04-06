//! DHCP UDP server for signapps-securelink.
//!
//! Listens on UDP port 6767 (non-privileged alternative to 67) and processes
//! DHCP DISCOVER / OFFER / REQUEST / ACK packets using the lease allocation
//! logic from `signapps_dns_server::dhcp`.
//!
//! # Wire format (simplified)
//!
//! DHCP messages follow RFC 2131 — a fixed 236-byte header followed by a
//! 4-byte magic cookie (`0x63825363`) and variable-length options.

use signapps_dns_server::dhcp::{
    allocate_ip, create_lease, DhcpMessageType, DhcpPacket, DhcpResponse,
};
use sqlx::PgPool;
use tokio::net::UdpSocket;
use tokio::sync::watch;
use uuid::Uuid;

/// Configuration for the DHCP listener.
#[derive(Debug, Clone)]
pub struct DhcpListenerConfig {
    /// Bind address (default `0.0.0.0:6767`).
    pub bind_addr: String,
    /// Default scope ID to allocate from when none can be inferred.
    pub default_scope_id: Option<Uuid>,
    /// Default lease duration in hours.
    pub default_lease_hours: i32,
    /// Default domain name to assign to clients.
    pub domain_name: String,
}

impl Default for DhcpListenerConfig {
    fn default() -> Self {
        Self {
            bind_addr: "0.0.0.0:6767".to_string(),
            default_scope_id: None,
            default_lease_hours: 8,
            domain_name: "local".to_string(),
        }
    }
}

/// Run the DHCP UDP listener.
///
/// # Errors
///
/// Returns an error if the UDP socket cannot bind.
///
/// # Panics
///
/// No panics — all errors are logged and the connection continues.
#[tracing::instrument(skip(pool, shutdown_rx))]
pub async fn run_dhcp_listener(
    config: DhcpListenerConfig,
    pool: PgPool,
    mut shutdown_rx: watch::Receiver<bool>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let socket = UdpSocket::bind(&config.bind_addr).await?;
    tracing::info!(addr = %config.bind_addr, "DHCP server started");

    let mut buf = [0u8; 1500];

    loop {
        tokio::select! {
            result = socket.recv_from(&mut buf) => {
                match result {
                    Ok((len, addr)) if len >= 240 => {
                        let packet_bytes = &buf[..len];
                        match parse_dhcp_packet(packet_bytes) {
                            Some(pkt) => {
                                let mac_str = format_mac(&pkt.mac_address);
                                tracing::debug!(
                                    mac = %mac_str,
                                    msg_type = ?pkt.message_type,
                                    "DHCP packet received"
                                );

                                match pkt.message_type {
                                    DhcpMessageType::Discover => {
                                        if let Some(resp) = handle_discover(&pool, &config, &pkt).await {
                                            let reply = build_dhcp_reply(&pkt, &resp);
                                            if let Err(e) = socket.send_to(&reply, addr).await {
                                                tracing::warn!(peer = %addr, "DHCP OFFER send error: {}", e);
                                            }
                                        }
                                    }
                                    DhcpMessageType::Request => {
                                        if let Some(resp) = handle_request(&pool, &config, &pkt).await {
                                            let reply = build_dhcp_reply(&pkt, &resp);
                                            if let Err(e) = socket.send_to(&reply, addr).await {
                                                tracing::warn!(peer = %addr, "DHCP ACK send error: {}", e);
                                            }
                                        }
                                    }
                                    DhcpMessageType::Release => {
                                        handle_release(&pool, &pkt).await;
                                    }
                                    _ => {
                                        tracing::debug!(msg_type = ?pkt.message_type, "DHCP message type ignored");
                                    }
                                }
                            }
                            None => {
                                tracing::debug!(peer = %addr, len, "Malformed DHCP packet");
                            }
                        }
                    }
                    Ok((len, addr)) => {
                        tracing::debug!(peer = %addr, len, "DHCP packet too short");
                    }
                    Err(e) => {
                        tracing::error!("DHCP recv error: {}", e);
                    }
                }
            }
            _ = async {
                loop {
                    shutdown_rx.changed().await.ok();
                    if *shutdown_rx.borrow() { break; }
                }
            } => {
                tracing::info!("DHCP server shutting down");
                break;
            }
        }
    }

    Ok(())
}

/// Handle a DHCP DISCOVER — allocate an IP and return an OFFER.
async fn handle_discover(
    pool: &PgPool,
    config: &DhcpListenerConfig,
    pkt: &DhcpPacket,
) -> Option<DhcpResponse> {
    let scope = resolve_scope(pool, config).await?;
    let mac_str = format_mac(&pkt.mac_address);

    match allocate_ip(pool, scope.id, &mac_str).await {
        Ok(ip) => {
            tracing::info!(ip = %ip, mac = %mac_str, "DHCP OFFER");
            Some(build_response(DhcpMessageType::Offer, &ip, &scope, config))
        }
        Err(e) => {
            tracing::warn!(mac = %mac_str, "DHCP DISCOVER allocation failed: {}", e);
            None
        }
    }
}

/// Handle a DHCP REQUEST — confirm the lease and return an ACK.
async fn handle_request(
    pool: &PgPool,
    config: &DhcpListenerConfig,
    pkt: &DhcpPacket,
) -> Option<DhcpResponse> {
    let scope = resolve_scope(pool, config).await?;
    let scope_id = scope.id;
    let mac_str = format_mac(&pkt.mac_address);

    // Allocate (or confirm) the IP
    let ip = match allocate_ip(pool, scope_id, &mac_str).await {
        Ok(ip) => ip,
        Err(e) => {
            tracing::warn!(mac = %mac_str, "DHCP REQUEST allocation failed: {}", e);
            return None;
        }
    };

    // Store IP as string before moving into create_lease (needed for DNS update below).
    let ip_str = ip.clone();

    // Create the lease record
    if let Err(e) = create_lease(
        pool,
        scope_id,
        &ip,
        &mac_str,
        pkt.hostname.as_deref(),
        None,
        config.default_lease_hours,
    )
    .await
    {
        tracing::error!(mac = %mac_str, ip = %ip, "Failed to create DHCP lease: {}", e);
        return None;
    }

    // DNS dynamic update — register A and PTR records for the new lease.
    if let Some(ref hostname) = pkt.hostname {
        let fqdn = format!("{}.{}", hostname, config.domain_name);

        let zone: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM ad_dns_zones WHERE zone_name = $1 LIMIT 1",
        )
        .bind(&config.domain_name)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();

        if let Some((zone_id,)) = zone {
            // Upsert A record: hostname.domain → IP
            let _ = sqlx::query(
                "INSERT INTO ad_dns_records \
                     (zone_id, name, record_type, rdata, ttl, is_static, timestamp) \
                 VALUES ($1, $2, 'A', $3, $4, false, now()) \
                 ON CONFLICT (zone_id, name, record_type) WHERE NOT is_static \
                 DO UPDATE SET rdata = EXCLUDED.rdata, timestamp = now()",
            )
            .bind(zone_id)
            .bind(&fqdn)
            .bind(serde_json::json!({"ip": ip_str}))
            .bind(300_i32)
            .execute(pool)
            .await;

            // Upsert reverse PTR record: x.z.y.x.in-addr.arpa → FQDN
            let octets: Vec<&str> = ip_str.split('.').collect();
            if octets.len() == 4 {
                let reverse_name = format!(
                    "{}.{}.{}.{}.in-addr.arpa",
                    octets[3], octets[2], octets[1], octets[0]
                );
                let _ = sqlx::query(
                    "INSERT INTO ad_dns_records \
                         (zone_id, name, record_type, rdata, ttl, is_static, timestamp) \
                     VALUES ($1, $2, 'PTR', $3, $4, false, now()) \
                     ON CONFLICT (zone_id, name, record_type) WHERE NOT is_static \
                     DO UPDATE SET rdata = EXCLUDED.rdata, timestamp = now()",
                )
                .bind(zone_id)
                .bind(&reverse_name)
                .bind(serde_json::json!({"target": fqdn}))
                .bind(300_i32)
                .execute(pool)
                .await;
            }

            tracing::info!(
                fqdn = %fqdn,
                ip = %ip_str,
                "DHCP→DNS dynamic update applied"
            );
        } else {
            tracing::debug!(
                domain = %config.domain_name,
                "No DNS zone found for DHCP domain — skipping dynamic update"
            );
        }
    }

    tracing::info!(ip = %ip, mac = %mac_str, "DHCP ACK");
    Some(build_response(DhcpMessageType::Ack, &ip, &scope, config))
}

/// Handle a DHCP RELEASE — deactivate the lease.
async fn handle_release(pool: &PgPool, pkt: &DhcpPacket) {
    let mac_str = format_mac(&pkt.mac_address);
    let result = sqlx::query(
        "UPDATE infrastructure.dhcp_leases SET is_active = false \
         WHERE mac_address = $1 AND is_active = true",
    )
    .bind(&mac_str)
    .execute(pool)
    .await;

    match result {
        Ok(r) => {
            tracing::info!(mac = %mac_str, rows = r.rows_affected(), "DHCP RELEASE processed");
        }
        Err(e) => {
            tracing::warn!(mac = %mac_str, "DHCP RELEASE DB error: {}", e);
        }
    }
}

/// Resolved scope data from the database.
struct ResolvedScope {
    id: Uuid,
    gateway: Option<String>,
    dns_servers: Vec<String>,
    ntp_servers: Vec<String>,
    domain_name: Option<String>,
    lease_duration_hours: i32,
    pxe_server: Option<String>,
    pxe_bootfile: Option<String>,
}

/// Find the first active scope and load its full configuration.
async fn resolve_scope(pool: &PgPool, config: &DhcpListenerConfig) -> Option<ResolvedScope> {
    let scope_filter = if let Some(id) = config.default_scope_id {
        format!("id = '{id}'")
    } else {
        "TRUE".to_string()
    };

    let row: Option<(Uuid, Option<String>, Vec<String>, Vec<String>, Option<String>, i32, Option<String>, Option<String>)> =
        sqlx::query_as(&format!(
            "SELECT id, gateway, dns_servers, ntp_servers, domain_name, \
             lease_duration_hours, pxe_server, pxe_bootfile \
             FROM infrastructure.dhcp_scopes \
             WHERE is_active = true AND {scope_filter} \
             ORDER BY created_at LIMIT 1"
        ))
        .fetch_optional(pool)
        .await
        .ok()?;

    row.map(|(id, gateway, dns_servers, ntp_servers, domain_name, lease_hours, pxe_server, pxe_bootfile)| {
        ResolvedScope { id, gateway, dns_servers, ntp_servers, domain_name, lease_duration_hours: lease_hours, pxe_server, pxe_bootfile }
    })
}

/// Build a DhcpResponse using real scope data from the database.
fn build_response(
    msg_type: DhcpMessageType,
    ip_str: &str,
    scope: &ResolvedScope,
    config: &DhcpListenerConfig,
) -> DhcpResponse {
    let ip = parse_ipv4(ip_str);

    // Gateway: use scope value, or default to x.x.x.1
    let gateway = scope.gateway.as_deref()
        .map(|g| parse_ipv4(g))
        .unwrap_or([ip[0], ip[1], ip[2], 1]);

    // DNS servers from scope, fallback to gateway
    let dns_servers: Vec<[u8; 4]> = if scope.dns_servers.is_empty() {
        vec![gateway]
    } else {
        scope.dns_servers.iter().map(|s| parse_ipv4(s)).collect()
    };

    // NTP servers from scope, fallback to gateway
    let ntp_servers: Vec<[u8; 4]> = if scope.ntp_servers.is_empty() {
        vec![gateway]
    } else {
        scope.ntp_servers.iter().map(|s| parse_ipv4(s)).collect()
    };

    let domain_name = scope.domain_name.clone()
        .unwrap_or_else(|| config.domain_name.clone());

    let lease_seconds = (scope.lease_duration_hours as u32) * 3600;

    DhcpResponse {
        message_type: msg_type as u8,
        offered_ip: ip,
        subnet_mask: [255, 255, 255, 0],
        gateway,
        dns_servers,
        ntp_servers,
        domain_name,
        lease_seconds,
        pxe_server: scope.pxe_server.clone(),
        pxe_bootfile: scope.pxe_bootfile.clone(),
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Wire format helpers
// ═══════════════════════════════════════════════════════════════════════════════

/// Parse a raw DHCP packet from bytes (RFC 2131 format).
fn parse_dhcp_packet(data: &[u8]) -> Option<DhcpPacket> {
    if data.len() < 240 {
        return None;
    }

    let op = data[0];
    let xid = u32::from_be_bytes([data[4], data[5], data[6], data[7]]);
    let mut mac_address = [0u8; 6];
    mac_address.copy_from_slice(&data[28..34]);

    // Parse options after magic cookie at offset 236
    let magic = &data[236..240];
    if magic != [0x63, 0x82, 0x53, 0x63] {
        return None;
    }

    let mut message_type = None;
    let mut hostname = None;
    let mut requested_ip = None;
    let mut parameter_list = Vec::new();

    let mut i = 240;
    while i < data.len() {
        let option = data[i];
        if option == 255 {
            break; // End
        }
        if option == 0 {
            i += 1; // Padding
            continue;
        }
        if i + 1 >= data.len() {
            break;
        }
        let len = data[i + 1] as usize;
        let start = i + 2;
        let end = start + len;
        if end > data.len() {
            break;
        }
        let value = &data[start..end];

        match option {
            53 if len == 1 => {
                message_type = DhcpMessageType::from_u8(value[0]);
            }
            12 => {
                hostname = String::from_utf8(value.to_vec()).ok();
            }
            50 if len == 4 => {
                requested_ip = Some([value[0], value[1], value[2], value[3]]);
            }
            55 => {
                parameter_list = value.to_vec();
            }
            _ => {}
        }

        i = end;
    }

    Some(DhcpPacket {
        op,
        xid,
        mac_address,
        requested_ip,
        message_type: message_type?,
        hostname,
        parameter_list,
    })
}

/// Build a raw DHCP reply packet from a DhcpResponse.
fn build_dhcp_reply(request: &DhcpPacket, response: &DhcpResponse) -> Vec<u8> {
    let mut pkt = vec![0u8; 300];

    // Fixed header
    pkt[0] = 2; // BOOTREPLY
    pkt[1] = 1; // Ethernet
    pkt[2] = 6; // HW addr len
    // xid
    pkt[4..8].copy_from_slice(&request.xid.to_be_bytes());
    // yiaddr (your IP address)
    pkt[16..20].copy_from_slice(&response.offered_ip);
    // chaddr (client hardware address)
    pkt[28..34].copy_from_slice(&request.mac_address);

    // Magic cookie
    pkt[236..240].copy_from_slice(&[0x63, 0x82, 0x53, 0x63]);

    let mut pos = 240;

    // Option 53: Message Type
    pkt[pos] = 53;
    pkt[pos + 1] = 1;
    pkt[pos + 2] = response.message_type;
    pos += 3;

    // Option 1: Subnet Mask
    pkt[pos] = 1;
    pkt[pos + 1] = 4;
    pkt[pos + 2..pos + 6].copy_from_slice(&response.subnet_mask);
    pos += 6;

    // Option 3: Router
    pkt[pos] = 3;
    pkt[pos + 1] = 4;
    pkt[pos + 2..pos + 6].copy_from_slice(&response.gateway);
    pos += 6;

    // Option 6: DNS Servers
    if !response.dns_servers.is_empty() {
        pkt[pos] = 6;
        pkt[pos + 1] = (response.dns_servers.len() * 4) as u8;
        pos += 2;
        for dns in &response.dns_servers {
            pkt[pos..pos + 4].copy_from_slice(dns);
            pos += 4;
        }
    }

    // Option 42: NTP Servers
    if !response.ntp_servers.is_empty() {
        pkt[pos] = 42;
        pkt[pos + 1] = (response.ntp_servers.len() * 4) as u8;
        pos += 2;
        for ntp in &response.ntp_servers {
            pkt[pos..pos + 4].copy_from_slice(ntp);
            pos += 4;
        }
    }

    // Option 15: Domain Name
    if !response.domain_name.is_empty() {
        let name_bytes = response.domain_name.as_bytes();
        pkt[pos] = 15;
        pkt[pos + 1] = name_bytes.len() as u8;
        pos += 2;
        pkt[pos..pos + name_bytes.len()].copy_from_slice(name_bytes);
        pos += name_bytes.len();
    }

    // Option 51: Lease Time
    pkt[pos] = 51;
    pkt[pos + 1] = 4;
    pkt[pos + 2..pos + 6].copy_from_slice(&response.lease_seconds.to_be_bytes());
    pos += 6;

    // Option 66: PXE Next Server
    if let Some(ref pxe_server) = response.pxe_server {
        let server_bytes = pxe_server.as_bytes();
        pkt[pos] = 66;
        pkt[pos + 1] = server_bytes.len() as u8;
        pos += 2;
        pkt[pos..pos + server_bytes.len()].copy_from_slice(server_bytes);
        pos += server_bytes.len();
    }

    // Option 67: PXE Bootfile
    if let Some(ref pxe_bootfile) = response.pxe_bootfile {
        let file_bytes = pxe_bootfile.as_bytes();
        pkt[pos] = 67;
        pkt[pos + 1] = file_bytes.len() as u8;
        pos += 2;
        pkt[pos..pos + file_bytes.len()].copy_from_slice(file_bytes);
        pos += file_bytes.len();
    }

    // End option
    pkt[pos] = 255;
    pos += 1;

    pkt.truncate(pos);
    pkt
}

/// Format a 6-byte MAC address as `AA:BB:CC:DD:EE:FF`.
fn format_mac(mac: &[u8; 6]) -> String {
    format!(
        "{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
        mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]
    )
}

/// Parse a dotted-decimal IPv4 string to `[u8; 4]`.
fn parse_ipv4(ip: &str) -> [u8; 4] {
    let parts: Vec<u8> = ip.split('.').filter_map(|p| p.parse().ok()).collect();
    if parts.len() == 4 {
        [parts[0], parts[1], parts[2], parts[3]]
    } else {
        [0, 0, 0, 0]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_mac_works() {
        let mac = [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF];
        assert_eq!(format_mac(&mac), "AA:BB:CC:DD:EE:FF");
    }

    #[test]
    fn parse_ipv4_works() {
        assert_eq!(parse_ipv4("192.168.1.100"), [192, 168, 1, 100]);
        assert_eq!(parse_ipv4("10.0.0.1"), [10, 0, 0, 1]);
    }

    #[test]
    fn build_and_parse_roundtrip() {
        // Build a minimal DHCP DISCOVER packet
        let mut pkt_bytes = vec![0u8; 300];
        pkt_bytes[0] = 1; // BOOTREQUEST
        pkt_bytes[1] = 1; // Ethernet
        pkt_bytes[2] = 6; // HW addr len
        // xid = 0x12345678
        pkt_bytes[4..8].copy_from_slice(&0x12345678u32.to_be_bytes());
        // MAC
        pkt_bytes[28..34].copy_from_slice(&[0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x01]);
        // Magic cookie
        pkt_bytes[236..240].copy_from_slice(&[0x63, 0x82, 0x53, 0x63]);
        // Option 53: DISCOVER (1)
        pkt_bytes[240] = 53;
        pkt_bytes[241] = 1;
        pkt_bytes[242] = 1;
        // Option 12: hostname "test-pc"
        let hostname = b"test-pc";
        pkt_bytes[243] = 12;
        pkt_bytes[244] = hostname.len() as u8;
        pkt_bytes[245..245 + hostname.len()].copy_from_slice(hostname);
        // End
        pkt_bytes[245 + hostname.len()] = 255;

        let parsed = parse_dhcp_packet(&pkt_bytes).unwrap();
        assert_eq!(parsed.op, 1);
        assert_eq!(parsed.xid, 0x12345678);
        assert_eq!(parsed.mac_address, [0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x01]);
        assert_eq!(parsed.message_type, DhcpMessageType::Discover);
        assert_eq!(parsed.hostname.as_deref(), Some("test-pc"));
    }

    #[test]
    fn reply_has_magic_cookie() {
        let req = DhcpPacket {
            op: 1,
            xid: 42,
            mac_address: [0x11, 0x22, 0x33, 0x44, 0x55, 0x66],
            requested_ip: None,
            message_type: DhcpMessageType::Discover,
            hostname: None,
            parameter_list: vec![],
        };
        let resp = DhcpResponse {
            message_type: 2,
            offered_ip: [192, 168, 1, 100],
            subnet_mask: [255, 255, 255, 0],
            gateway: [192, 168, 1, 1],
            dns_servers: vec![[192, 168, 1, 1]],
            ntp_servers: vec![],
            domain_name: "local".to_string(),
            lease_seconds: 28800,
            pxe_server: None,
            pxe_bootfile: None,
        };
        let reply = build_dhcp_reply(&req, &resp);

        // Check magic cookie
        assert_eq!(&reply[236..240], &[0x63, 0x82, 0x53, 0x63]);
        // Check yiaddr
        assert_eq!(&reply[16..20], &[192, 168, 1, 100]);
        // Check op = BOOTREPLY
        assert_eq!(reply[0], 2);
    }
}
