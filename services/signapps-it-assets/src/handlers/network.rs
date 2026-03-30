use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_db::DatabasePool;
use std::net::{IpAddr, SocketAddr, TcpStream};
use std::str::FromStr;
use std::time::Duration;
use uuid::Uuid;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
/// Represents a network discovery.
pub struct NetworkDiscovery {
    pub id: Uuid,
    pub subnet: String,
    pub ip_address: ipnetwork::IpNetwork,
    pub mac_address: Option<String>,
    pub hostname: Option<String>,
    pub os_guess: Option<String>,
    pub response_time_ms: Option<i32>,
    pub open_ports: Vec<i32>,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub hardware_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
/// Represents a scan subnet req.
pub struct ScanSubnetReq {
    /// CIDR subnet, e.g. "192.168.1.0/24"
    pub subnet: String,
    /// Optional timeout per host in ms (default 500)
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
/// Represents a scan result.
pub struct ScanResult {
    pub subnet: String,
    pub hosts_scanned: usize,
    pub hosts_found: usize,
    pub discoveries: Vec<DiscoveryEntry>,
}

#[derive(Debug, Serialize, Clone)]
/// Represents a discovery entry.
pub struct DiscoveryEntry {
    pub ip: String,
    pub mac_address: Option<String>,
    pub hostname: Option<String>,
    pub os_guess: Option<String>,
    pub response_time_ms: u64,
    pub open_ports: Vec<u16>,
}

#[derive(Debug, Deserialize)]
/// Represents a port scan req.
pub struct PortScanReq {
    pub ip: String,
    pub ports: Vec<u16>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
/// Represents a port scan result.
pub struct PortScanResult {
    pub ip: String,
    pub open_ports: Vec<u16>,
    pub closed_ports: Vec<u16>,
    pub duration_ms: u64,
}

#[derive(Debug, Deserialize)]
/// Represents a add to inventory req.
pub struct AddToInventoryReq {
    #[allow(dead_code)]
    pub discovery_id: Option<Uuid>,
    pub name: String,
    pub asset_type: Option<String>,
}

// ─── Common ports to probe during discovery ───────────────────────────────────

const DISCOVERY_PORTS: &[u16] = &[22, 80, 443, 3389, 445, 139, 8080, 8443];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Parse a CIDR subnet and enumerate all host addresses.
fn parse_cidr_hosts(cidr: &str) -> Result<Vec<IpAddr>, String> {
    use std::net::Ipv4Addr;

    // Parse "192.168.1.0/24" format
    let parts: Vec<&str> = cidr.split('/').collect();
    if parts.len() != 2 {
        return Err(format!("Invalid CIDR: {}", cidr));
    }
    let base: Ipv4Addr = parts[0]
        .parse()
        .map_err(|_| format!("Invalid IP: {}", parts[0]))?;
    let prefix: u32 = parts[1]
        .parse()
        .map_err(|_| format!("Invalid prefix: {}", parts[1]))?;

    if prefix > 32 {
        return Err("Prefix must be <= 32".to_string());
    }
    if prefix < 16 {
        return Err("Subnet too large (min /16 for safety)".to_string());
    }

    let host_bits = 32 - prefix;
    let host_count = (1u32 << host_bits).saturating_sub(2); // exclude network and broadcast
    if host_count > 1024 {
        return Err(format!(
            "Subnet too large: {} hosts (max 1024 for MVP)",
            host_count
        ));
    }

    let base_u32 = u32::from(base);
    let mask = !0u32 << host_bits;
    let network = base_u32 & mask;

    let hosts: Vec<IpAddr> = (1..=host_count)
        .map(|i| {
            let addr = network + i;
            IpAddr::V4(Ipv4Addr::from(addr))
        })
        .collect();

    Ok(hosts)
}

/// Probe a single host: TCP connect on common ports, measure RTT.
fn probe_host(ip: IpAddr, timeout_ms: u64) -> Option<DiscoveryEntry> {
    let timeout = Duration::from_millis(timeout_ms);
    let start = std::time::Instant::now();

    // Try ICMP-like approach via TCP connect to port 7 or common ports
    let mut is_alive = false;
    let mut open_ports: Vec<u16> = Vec::new();

    for &port in DISCOVERY_PORTS {
        let addr = SocketAddr::new(ip, port);
        if TcpStream::connect_timeout(&addr, timeout).is_ok() {
            is_alive = true;
            open_ports.push(port);
        }
    }

    // Also try a TCP connect to port 443 for liveness (already covered above)
    // Try ping-like: connect to any port to detect host
    if !is_alive {
        let addr = SocketAddr::new(ip, 65535);
        if let Ok(_) | Err(_) = TcpStream::connect_timeout(&addr, Duration::from_millis(50)) {
            // If we get connection refused quickly, host is alive
            // If we timeout, host is likely down
            // We check by elapsed time: < timeout/2 means host responded (refused or accepted)
            if start.elapsed().as_millis() < (timeout_ms / 2) as u128 {
                is_alive = true;
            }
        }
    }

    if !is_alive {
        return None;
    }

    let response_time_ms = start.elapsed().as_millis() as u64;

    // Reverse DNS lookup (best-effort)
    let hostname = reverse_dns_lookup(ip);

    // OS guessing based on open ports
    let os_guess = guess_os(&open_ports);

    Some(DiscoveryEntry {
        ip: ip.to_string(),
        mac_address: None, // MAC only available via ARP on same subnet
        hostname,
        os_guess,
        response_time_ms,
        open_ports,
    })
}

fn reverse_dns_lookup(ip: IpAddr) -> Option<String> {
    // Use std DNS resolution (best-effort, may be slow)
    // In production, use tokio's async resolver
    let _ = ip;
    None // Simplified for MVP; real impl: use trust-dns or std lookup_addr
}

fn guess_os(open_ports: &[u16]) -> Option<String> {
    if open_ports.contains(&3389) {
        Some("Windows (RDP)".to_string())
    } else if open_ports.contains(&22) && open_ports.contains(&445) {
        Some("Linux/Samba".to_string())
    } else if open_ports.contains(&22) {
        Some("Linux/Unix".to_string())
    } else if open_ports.contains(&445) || open_ports.contains(&139) {
        Some("Windows (SMB)".to_string())
    } else {
        None
    }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/// POST /api/v1/it-assets/network/scan
/// Perform an ARP/ping sweep on a subnet and store results.
pub async fn scan_network(
    State(pool): State<DatabasePool>,
    Json(payload): Json<ScanSubnetReq>,
) -> Result<Json<ScanResult>, (StatusCode, String)> {
    let timeout_ms = payload.timeout_ms.unwrap_or(500).min(5000);

    // Parse CIDR to get host list
    let hosts = parse_cidr_hosts(&payload.subnet).map_err(|e| (StatusCode::BAD_REQUEST, e))?;

    let total_hosts = hosts.len();
    let subnet = payload.subnet.clone();

    // Run probes in a blocking thread pool (CPU-bound TCP connects)
    let discoveries: Vec<DiscoveryEntry> = tokio::task::spawn_blocking(move || {
        hosts
            .into_iter()
            .filter_map(|ip| probe_host(ip, timeout_ms))
            .collect()
    })
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let hosts_found = discoveries.len();

    // Persist results to DB
    for entry in &discoveries {
        let ip_parsed: ipnetwork::IpNetwork =
            entry.ip.parse().map_err(|e: ipnetwork::IpNetworkError| {
                (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
            })?;
        let ports_i32: Vec<i32> = entry.open_ports.iter().map(|&p| p as i32).collect();

        sqlx::query(
            r#"
            INSERT INTO it.network_discoveries
                (subnet, ip_address, mac_address, hostname, os_guess, response_time_ms, open_ports, last_seen)
            VALUES ($1, $2, $3, $4, $5, $6, $7, now())
            ON CONFLICT (ip_address) DO UPDATE SET
                hostname = COALESCE(EXCLUDED.hostname, it.network_discoveries.hostname),
                os_guess = COALESCE(EXCLUDED.os_guess, it.network_discoveries.os_guess),
                response_time_ms = EXCLUDED.response_time_ms,
                open_ports = EXCLUDED.open_ports,
                last_seen = now()
            "#,
        )
        .bind(&subnet)
        .bind(ip_parsed)
        .bind(&entry.mac_address)
        .bind(&entry.hostname)
        .bind(&entry.os_guess)
        .bind(entry.response_time_ms as i32)
        .bind(&ports_i32)
        .execute(pool.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    tracing::info!(
        "Network scan of {} complete: {}/{} hosts found",
        payload.subnet,
        hosts_found,
        total_hosts
    );

    Ok(Json(ScanResult {
        subnet: payload.subnet,
        hosts_scanned: total_hosts,
        hosts_found,
        discoveries,
    }))
}

/// GET /api/v1/it-assets/network/discoveries
/// List all network discoveries.
pub async fn list_discoveries(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<NetworkDiscovery>>, (StatusCode, String)> {
    let discoveries = sqlx::query_as::<_, NetworkDiscovery>(
        r#"
        SELECT id, subnet, ip_address, mac_address, hostname, os_guess,
               response_time_ms, open_ports, first_seen, last_seen, hardware_id
        FROM it.network_discoveries
        ORDER BY last_seen DESC
        "#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(discoveries))
}

/// POST /api/v1/it-assets/network/discoveries/:id/add-to-inventory
/// Add a discovered host to the IT hardware inventory.
pub async fn add_discovery_to_inventory(
    State(pool): State<DatabasePool>,
    Path(discovery_id): Path<Uuid>,
    Json(payload): Json<AddToInventoryReq>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, String)> {
    // Fetch the discovery
    let row: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT ip_address::text, hostname FROM it.network_discoveries WHERE id = $1",
    )
    .bind(discovery_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (ip, _hostname) = row.ok_or((StatusCode::NOT_FOUND, "Discovery not found".to_string()))?;

    let asset_type = payload
        .asset_type
        .unwrap_or_else(|| "workstation".to_string());

    // Create a hardware asset
    let hw_row: (Uuid,) = sqlx::query_as(
        r#"
        INSERT INTO it.hardware (name, type, location, notes)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        "#,
    )
    .bind(&payload.name)
    .bind(&asset_type)
    .bind(Some(&ip))
    .bind(Some(format!("Ajouté depuis découverte réseau ({})", ip)))
    .fetch_one(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Link discovery to hardware
    sqlx::query("UPDATE it.network_discoveries SET hardware_id = $1 WHERE id = $2")
        .bind(hw_row.0)
        .bind(discovery_id)
        .execute(pool.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "hardware_id": hw_row.0,
            "name": payload.name,
            "ip": ip
        })),
    ))
}

/// POST /api/v1/it-assets/network/port-scan (ND4)
/// TCP port scan on a specific IP.
pub async fn port_scan(
    State(_pool): State<DatabasePool>,
    Json(payload): Json<PortScanReq>,
) -> Result<Json<PortScanResult>, (StatusCode, String)> {
    let ip: IpAddr = IpAddr::from_str(&payload.ip).map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            format!("Invalid IP: {}", payload.ip),
        )
    })?;

    if payload.ports.is_empty() || payload.ports.len() > 100 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Between 1 and 100 ports allowed".to_string(),
        ));
    }

    let timeout_ms = payload.timeout_ms.unwrap_or(1000).min(10000);
    let ports = payload.ports.clone();

    let start = std::time::Instant::now();
    let (open, closed) = tokio::task::spawn_blocking(move || {
        let timeout = Duration::from_millis(timeout_ms);
        let mut open = Vec::new();
        let mut closed = Vec::new();
        for &port in &ports {
            let addr = SocketAddr::new(ip, port);
            if TcpStream::connect_timeout(&addr, timeout).is_ok() {
                open.push(port);
            } else {
                closed.push(port);
            }
        }
        (open, closed)
    })
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let duration_ms = start.elapsed().as_millis() as u64;

    Ok(Json(PortScanResult {
        ip: payload.ip,
        open_ports: open,
        closed_ports: closed,
        duration_ms,
    }))
}

/// GET /api/v1/it-assets/network/snmp/:ip (ND2)
/// Query common SNMP OIDs for a given IP.
pub async fn query_snmp(
    State(pool): State<DatabasePool>,
    Path(ip): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    // Validate IP
    let _: IpAddr = IpAddr::from_str(&ip)
        .map_err(|_| (StatusCode::BAD_REQUEST, format!("Invalid IP: {}", ip)))?;

    // For MVP: return conceptual OID structure without actual SNMP library
    // Production would use a crate like `snmp` or `snmp-parser`
    let oids = serde_json::json!({
        "ip": ip,
        "status": "conceptual",
        "note": "SNMP querying requires the 'snmp' or 'snmp2' crate. Add to Cargo.toml to enable.",
        "oid_templates": [
            { "oid": "1.3.6.1.2.1.1.1.0", "name": "sysDescr", "description": "System description" },
            { "oid": "1.3.6.1.2.1.1.3.0", "name": "sysUpTime", "description": "System uptime in ticks" },
            { "oid": "1.3.6.1.2.1.1.5.0", "name": "sysName", "description": "System name/hostname" },
            { "oid": "1.3.6.1.2.1.2.2", "name": "ifTable", "description": "Interface table" },
            { "oid": "1.3.6.1.2.1.25.1.1.0", "name": "hrSystemUptime", "description": "Host Resources MIB uptime" }
        ]
    });

    // Store a record that SNMP was queried
    let ip_parsed: ipnetwork::IpNetwork = ip.parse().map_err(|e: ipnetwork::IpNetworkError| {
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    sqlx::query(
        r#"
        INSERT INTO it.snmp_data (ip_address, oid, oid_name, value)
        VALUES ($1, '1.3.6.1.2.1.1.1.0', 'sysDescr', 'SNMP not yet implemented — conceptual record')
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(ip_parsed)
    .execute(pool.inner())
    .await
    .ok(); // Non-fatal if fails

    Ok(Json(oids))
}
