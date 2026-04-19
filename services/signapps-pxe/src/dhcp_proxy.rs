// PX1: ProxyDHCP server on UDP 4011
// Responds to PXE DHCP requests with TFTP server IP + boot filename
//
// Protocol: RFC 4578 / PXE spec
// Machine sends DHCPDISCOVER with option 60 "PXEClient", we respond with
// DHCPOFFER containing next-server (siaddr) and boot filename (file field).

use signapps_db::DatabasePool;
use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use tracing::{debug, error, info, warn};

/// DHCP option codes relevant to PXE
const OPT_DHCP_MSG_TYPE: u8 = 53;
const OPT_SERVER_ID: u8 = 54;
const OPT_CLASS_ID: u8 = 60;
const OPT_CLIENT_UUID: u8 = 97;
const OPT_END: u8 = 255;

/// DHCP message types
const DHCPDISCOVER: u8 = 1;
const DHCPOFFER: u8 = 2;
const DHCPREQUEST: u8 = 3;
const DHCPACK: u8 = 5;

/// DHCP opcodes
const BOOTREQUEST: u8 = 1;
const BOOTREPLY: u8 = 2;

/// ProxyDHCP config. Bind address defaults to the port resolved by
/// [`crate::resolve_dhcp_port`] (4011 in user mode, 67 in root mode).
pub struct ProxyDhcpConfig {
    /// Primary TFTP server IP advertised in DHCPOFFER (siaddr).
    pub tftp_server_ip: Ipv4Addr,
    /// Boot filename advertised in DHCPOFFER (file field).
    pub boot_filename: String,
    /// UDP bind address for the ProxyDHCP socket.
    pub bind_addr: SocketAddr,
    /// Optional DB pool for auto-discovery logging. When `Some`, every
    /// received PXE DHCPDISCOVER/REQUEST is recorded in `pxe.dhcp_requests`.
    pub db: Option<DatabasePool>,
    /// If `true`, unknown MACs are auto-upserted into `pxe.assets` with
    /// `status='discovered'` so operators can enroll them from the UI.
    pub auto_enroll: bool,
}

impl Default for ProxyDhcpConfig {
    fn default() -> Self {
        let port = crate::resolve_dhcp_port();
        let bind_addr = format!("0.0.0.0:{}", port)
            .parse()
            .expect("valid bind address");
        Self {
            tftp_server_ip: Ipv4Addr::new(0, 0, 0, 0),
            boot_filename: "pxelinux.0".to_string(),
            bind_addr,
            db: None,
            auto_enroll: false,
        }
    }
}

/// Start the proxyDHCP server. Blocks until error.
///
/// # Errors
///
/// Returns an error if the UDP socket cannot be bound (typically when a
/// privileged port is requested without root, or the port is already in
/// use by another process).
pub async fn start_proxy_dhcp(config: ProxyDhcpConfig) -> anyhow::Result<()> {
    // Resolve the TFTP server IP (use the machine's primary IP if 0.0.0.0)
    let tftp_ip = if config.tftp_server_ip == Ipv4Addr::UNSPECIFIED {
        detect_local_ip().unwrap_or(Ipv4Addr::new(127, 0, 0, 1))
    } else {
        config.tftp_server_ip
    };

    // Use tokio's blocking task for UDP I/O (simple enough to not need async)
    let bind_addr = config.bind_addr;
    let boot_filename = config.boot_filename.clone();
    let db = config.db.clone();
    let auto_enroll = config.auto_enroll;
    let tokio_handle = tokio::runtime::Handle::current();

    tokio::task::spawn_blocking(move || {
        run_proxy_dhcp_loop(bind_addr, tftp_ip, &boot_filename, db, auto_enroll, tokio_handle)
    })
    .await?
}

fn run_proxy_dhcp_loop(
    bind_addr: SocketAddr,
    tftp_ip: Ipv4Addr,
    boot_filename: &str,
    db: Option<DatabasePool>,
    auto_enroll: bool,
    tokio_handle: tokio::runtime::Handle,
) -> anyhow::Result<()> {
    let socket = UdpSocket::bind(bind_addr)?;
    // Enable broadcast only when we're not bound exclusively to loopback —
    // on Windows, SO_BROADCAST on a loopback socket can interfere with
    // unicast delivery for integration tests.
    if !bind_addr.ip().is_loopback() {
        socket.set_broadcast(true)?;
    }
    info!(
        "ProxyDHCP server listening on {} (TFTP: {}, file: {})",
        bind_addr, tftp_ip, boot_filename
    );

    let mut buf = [0u8; 1024];

    loop {
        match socket.recv_from(&mut buf) {
            Ok((len, src)) => {
                let packet = &buf[..len];
                if let Err(e) = handle_dhcp_packet(
                    &socket,
                    packet,
                    src,
                    tftp_ip,
                    boot_filename,
                    db.as_ref(),
                    auto_enroll,
                    &tokio_handle,
                ) {
                    warn!("ProxyDHCP packet handling error from {}: {}", src, e);
                }
            },
            Err(e) => {
                error!("ProxyDHCP recv error: {}", e);
            },
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn handle_dhcp_packet(
    socket: &UdpSocket,
    packet: &[u8],
    src: SocketAddr,
    tftp_ip: Ipv4Addr,
    boot_filename: &str,
    db: Option<&DatabasePool>,
    auto_enroll: bool,
    tokio_handle: &tokio::runtime::Handle,
) -> anyhow::Result<()> {
    // Minimum DHCP packet size is 236 bytes (fixed header)
    if packet.len() < 236 {
        return Ok(());
    }

    // Check opcode: must be BOOTREQUEST
    if packet[0] != BOOTREQUEST {
        return Ok(());
    }

    // Check for PXE client option (option 60 = "PXEClient")
    let options = &packet[236..];
    if !is_pxe_client(options) {
        debug!("Non-PXE DHCP packet from {}, ignoring", src);
        return Ok(());
    }

    // Get message type
    let msg_type = get_option(options, OPT_DHCP_MSG_TYPE)
        .and_then(|v| v.first().copied())
        .unwrap_or(0);

    if msg_type != DHCPDISCOVER && msg_type != DHCPREQUEST {
        return Ok(());
    }

    // Extract transaction ID and client MAC
    let xid = &packet[4..8];
    let chaddr = &packet[28..44]; // client hardware address (MAC is first 6 bytes)

    info!(
        "ProxyDHCP: PXE {} from {:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
        if msg_type == DHCPDISCOVER {
            "DISCOVER"
        } else {
            "REQUEST"
        },
        chaddr[0],
        chaddr[1],
        chaddr[2],
        chaddr[3],
        chaddr[4],
        chaddr[5]
    );

    // Build DHCPOFFER (or DHCPACK for REQUEST)
    let reply_type = if msg_type == DHCPDISCOVER {
        DHCPOFFER
    } else {
        DHCPACK
    };
    let reply = build_pxe_offer(xid, chaddr, tftp_ip, boot_filename, reply_type)?;

    // Send to broadcast or unicast depending on flags.
    // Special case: loopback source (integration tests) — always unicast
    // back to the exact source port, since 255.255.255.255 can't reach
    // a client socket bound on 127.0.0.1.
    let dest = if src.ip().is_loopback() {
        src
    } else if src.port() == 68 {
        // Client port — send unicast
        src
    } else {
        // Send to broadcast
        "255.255.255.255:68".parse()?
    };

    socket.send_to(&reply, dest)?;
    debug!("ProxyDHCP: sent {} bytes to {}", reply.len(), dest);

    // Auto-discovery: record DHCP request in DB and upsert the asset.
    // We spawn a tokio task so the UDP loop is never blocked on the DB.
    if let Some(db_ref) = db {
        let mac = format!(
            "{:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
            chaddr[0], chaddr[1], chaddr[2], chaddr[3], chaddr[4], chaddr[5]
        );
        let vendor_class = get_option(&options[4..], OPT_CLASS_ID)
            .and_then(|v| std::str::from_utf8(v).ok())
            .map(|s| s.to_string());
        let boot_file = boot_filename.to_string();
        let msg_type_label = if msg_type == DHCPDISCOVER { "DISCOVER" } else { "REQUEST" };
        let db_clone = db_ref.clone();
        tokio_handle.spawn(async move {
            if let Err(e) = crate::auto_enroll::record_dhcp_request(
                &db_clone,
                &mac,
                msg_type_label,
                vendor_class.as_deref(),
                None,
                true,
                Some(&boot_file),
                auto_enroll,
            )
            .await
            {
                tracing::warn!("Failed to record DHCP request for {}: {}", mac, e);
            }
        });
    }

    Ok(())
}

fn is_pxe_client(options: &[u8]) -> bool {
    // Skip magic cookie (first 4 bytes)
    if options.len() < 4 {
        return false;
    }
    let opts = &options[4..];
    if let Some(val) = get_option(opts, OPT_CLASS_ID) {
        return val.starts_with(b"PXEClient");
    }
    false
}

fn get_option(options: &[u8], code: u8) -> Option<&[u8]> {
    let mut i = 0;
    while i < options.len() {
        let opt_code = options[i];
        if opt_code == OPT_END {
            break;
        }
        if opt_code == 0 {
            i += 1;
            continue;
        }
        if i + 1 >= options.len() {
            break;
        }
        let len = options[i + 1] as usize;
        if i + 2 + len > options.len() {
            break;
        }
        if opt_code == code {
            return Some(&options[i + 2..i + 2 + len]);
        }
        i += 2 + len;
    }
    None
}

fn build_pxe_offer(
    xid: &[u8],
    chaddr: &[u8],
    tftp_ip: Ipv4Addr,
    boot_filename: &str,
    msg_type: u8,
) -> anyhow::Result<Vec<u8>> {
    let mut pkt = vec![0u8; 236];

    // Fixed DHCP header
    pkt[0] = BOOTREPLY; // op
    pkt[1] = 1; // htype: Ethernet
    pkt[2] = 6; // hlen: MAC length
    pkt[3] = 0; // hops

    // Transaction ID
    pkt[4..8].copy_from_slice(xid);

    // siaddr: TFTP server IP
    pkt[20..24].copy_from_slice(&tftp_ip.octets());

    // Copy client MAC
    let mac_len = chaddr.len().min(16);
    pkt[28..28 + mac_len].copy_from_slice(&chaddr[..mac_len]);

    // Boot filename (offset 108, 128 bytes)
    let fname_bytes = boot_filename.as_bytes();
    let fname_len = fname_bytes.len().min(127);
    pkt[108..108 + fname_len].copy_from_slice(&fname_bytes[..fname_len]);

    // DHCP magic cookie
    pkt.extend_from_slice(&[99, 130, 83, 99]);

    // Options
    // 53: DHCP message type
    pkt.extend_from_slice(&[OPT_DHCP_MSG_TYPE, 1, msg_type]);

    // 54: server identifier (TFTP IP)
    pkt.extend_from_slice(&[OPT_SERVER_ID, 4]);
    pkt.extend_from_slice(&tftp_ip.octets());

    // 60: class identifier = "PXEClient"
    let class_id = b"PXEClient";
    pkt.extend_from_slice(&[OPT_CLASS_ID, class_id.len() as u8]);
    pkt.extend_from_slice(class_id);

    // 97: client machine identifier (echo back if present — here we just put zeros)
    pkt.extend_from_slice(&[OPT_CLIENT_UUID, 17, 0]);
    pkt.extend_from_slice(&[0u8; 16]);

    // End option
    pkt.push(OPT_END);

    Ok(pkt)
}

fn detect_local_ip() -> Option<Ipv4Addr> {
    // Try connecting to a public IP to determine local IP without binding
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    let addr = socket.local_addr().ok()?;
    match addr.ip() {
        IpAddr::V4(ip) => Some(ip),
        _ => None,
    }
}
