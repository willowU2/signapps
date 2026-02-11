#![allow(dead_code)]
//! Local DNS server implementation.
//!
//! Provides a DNS server that listens on a configurable port,
//! intercepts queries, applies ad-blocking, and forwards to upstream.

use crate::dns::{AdBlocker, DnsResolver, StatsCounter};
use signapps_common::{Error, Result};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;
use tokio::net::UdpSocket;
use tokio::sync::broadcast;

/// Maximum DNS packet size.
const MAX_DNS_PACKET_SIZE: usize = 512;

/// DNS header flags.
mod flags {
    pub const QR_RESPONSE: u16 = 0x8000;
    pub const AA_AUTHORITATIVE: u16 = 0x0400;
    pub const RD_RECURSION_DESIRED: u16 = 0x0100;
    pub const RA_RECURSION_AVAILABLE: u16 = 0x0080;
    pub const RCODE_NXDOMAIN: u16 = 0x0003;
    pub const RCODE_NOERROR: u16 = 0x0000;
}

/// DNS record types.
mod record_types {
    pub const A: u16 = 1;
    pub const AAAA: u16 = 28;
    pub const CNAME: u16 = 5;
    pub const TXT: u16 = 16;
    pub const MX: u16 = 15;
}

/// Local DNS server.
pub struct DnsServer {
    /// Listen address.
    listen_addr: SocketAddr,
    /// DNS resolver for upstream queries.
    resolver: Arc<DnsResolver>,
    /// Ad-blocker for filtering.
    blocker: Arc<AdBlocker>,
    /// Statistics counter.
    stats: Arc<StatsCounter>,
    /// Shutdown signal sender.
    shutdown_tx: broadcast::Sender<()>,
}

impl DnsServer {
    /// Create a new DNS server.
    pub fn new(
        listen_addr: SocketAddr,
        resolver: Arc<DnsResolver>,
        blocker: Arc<AdBlocker>,
        stats: Arc<StatsCounter>,
    ) -> Self {
        let (shutdown_tx, _) = broadcast::channel(1);
        Self {
            listen_addr,
            resolver,
            blocker,
            stats,
            shutdown_tx,
        }
    }

    /// Start the DNS server.
    pub async fn run(&self) -> Result<()> {
        let socket = UdpSocket::bind(self.listen_addr)
            .await
            .map_err(|e| Error::Internal(format!("Failed to bind DNS socket: {}", e)))?;

        tracing::info!("DNS server listening on {}", self.listen_addr);

        let mut buf = vec![0u8; MAX_DNS_PACKET_SIZE];
        let mut shutdown_rx = self.shutdown_tx.subscribe();

        loop {
            tokio::select! {
                result = socket.recv_from(&mut buf) => {
                    match result {
                        Ok((len, src)) => {
                            let packet = buf[..len].to_vec();
                            let resolver = Arc::clone(&self.resolver);
                            let blocker = Arc::clone(&self.blocker);
                            let stats = Arc::clone(&self.stats);
                            let socket_clone = socket.local_addr().ok();

                            // Handle request in background
                            tokio::spawn(async move {
                                if let Err(e) = Self::handle_query(
                                    &packet,
                                    src,
                                    socket_clone,
                                    resolver,
                                    blocker,
                                    stats,
                                ).await {
                                    tracing::warn!("DNS query handling error: {}", e);
                                }
                            });
                        }
                        Err(e) => {
                            tracing::error!("DNS socket error: {}", e);
                        }
                    }
                }
                _ = shutdown_rx.recv() => {
                    tracing::info!("DNS server shutting down");
                    break;
                }
            }
        }

        Ok(())
    }

    /// Handle a single DNS query.
    async fn handle_query(
        packet: &[u8],
        src: SocketAddr,
        local_addr: Option<SocketAddr>,
        resolver: Arc<DnsResolver>,
        blocker: Arc<AdBlocker>,
        stats: Arc<StatsCounter>,
    ) -> Result<()> {
        let start = Instant::now();
        stats.inc_total();

        // Parse the DNS query
        let query = match DnsQuery::parse(packet) {
            Ok(q) => q,
            Err(e) => {
                tracing::debug!("Failed to parse DNS query from {}: {}", src, e);
                return Ok(());
            }
        };

        tracing::debug!(
            "DNS query from {}: {} (type {})",
            src,
            query.name,
            query.qtype
        );

        // Check if domain is blocked
        let response = if blocker.is_blocked(&query.name) {
            stats.inc_blocked();
            tracing::debug!("Blocked DNS query for: {}", query.name);
            DnsResponse::blocked(&query)
        } else {
            // Forward to upstream resolver
            stats.inc_upstream();
            match Self::resolve_query(&query, &resolver).await {
                Ok(resp) => resp,
                Err(e) => {
                    tracing::warn!("DNS resolution failed for {}: {}", query.name, e);
                    DnsResponse::servfail(&query)
                }
            }
        };

        // Send response
        if let Some(_addr) = local_addr {
            let socket = UdpSocket::bind("0.0.0.0:0").await?;
            socket.send_to(&response.to_bytes(), src).await?;
        }

        let elapsed = start.elapsed();
        stats.add_response_time(elapsed.as_millis() as u64);

        Ok(())
    }

    /// Resolve a DNS query using the resolver.
    async fn resolve_query(query: &DnsQuery, resolver: &DnsResolver) -> Result<DnsResponse> {
        let record_type = match query.qtype {
            record_types::A => "A",
            record_types::AAAA => "AAAA",
            record_types::CNAME => "CNAME",
            record_types::TXT => "TXT",
            record_types::MX => "MX",
            _ => "A",
        };

        let result = resolver.resolve(&query.name, record_type).await?;

        Ok(DnsResponse::success(query, &result.values, result.ttl))
    }

    /// Get a shutdown handle.
    pub fn shutdown_handle(&self) -> broadcast::Sender<()> {
        self.shutdown_tx.clone()
    }

    /// Shutdown the server.
    pub fn shutdown(&self) {
        let _ = self.shutdown_tx.send(());
    }
}

/// Parsed DNS query.
#[derive(Debug)]
struct DnsQuery {
    /// Transaction ID.
    id: u16,
    /// Query flags.
    flags: u16,
    /// Query name (domain).
    name: String,
    /// Query type.
    qtype: u16,
    /// Query class.
    qclass: u16,
    /// Raw query packet for response building.
    raw: Vec<u8>,
}

impl DnsQuery {
    /// Parse a DNS query packet.
    fn parse(packet: &[u8]) -> Result<Self> {
        if packet.len() < 12 {
            return Err(Error::Validation("DNS packet too short".to_string()));
        }

        let id = u16::from_be_bytes([packet[0], packet[1]]);
        let flags = u16::from_be_bytes([packet[2], packet[3]]);
        let qdcount = u16::from_be_bytes([packet[4], packet[5]]);

        if qdcount == 0 {
            return Err(Error::Validation("No questions in DNS packet".to_string()));
        }

        // Parse question section (starts at offset 12)
        let (name, offset) = Self::parse_name(packet, 12)?;

        if offset + 4 > packet.len() {
            return Err(Error::Validation("DNS packet truncated".to_string()));
        }

        let qtype = u16::from_be_bytes([packet[offset], packet[offset + 1]]);
        let qclass = u16::from_be_bytes([packet[offset + 2], packet[offset + 3]]);

        Ok(Self {
            id,
            flags,
            name,
            qtype,
            qclass,
            raw: packet.to_vec(),
        })
    }

    /// Parse a DNS name from the packet.
    fn parse_name(packet: &[u8], mut offset: usize) -> Result<(String, usize)> {
        let mut name_parts = Vec::new();
        let mut jumped = false;
        let mut jump_offset = 0;

        loop {
            if offset >= packet.len() {
                return Err(Error::Validation("DNS name extends beyond packet".to_string()));
            }

            let len = packet[offset] as usize;

            // Check for pointer (compression)
            if len & 0xC0 == 0xC0 {
                if offset + 1 >= packet.len() {
                    return Err(Error::Validation("DNS pointer truncated".to_string()));
                }
                let ptr = ((len & 0x3F) << 8) | packet[offset + 1] as usize;
                if !jumped {
                    jump_offset = offset + 2;
                }
                offset = ptr;
                jumped = true;
                continue;
            }

            if len == 0 {
                offset += 1;
                break;
            }

            if offset + 1 + len > packet.len() {
                return Err(Error::Validation("DNS label extends beyond packet".to_string()));
            }

            let label = String::from_utf8_lossy(&packet[offset + 1..offset + 1 + len]).to_string();
            name_parts.push(label);
            offset += 1 + len;
        }

        let final_offset = if jumped { jump_offset } else { offset };
        Ok((name_parts.join("."), final_offset))
    }
}

/// DNS response builder.
struct DnsResponse {
    /// Response bytes.
    data: Vec<u8>,
}

impl DnsResponse {
    /// Create a blocked response (NXDOMAIN).
    fn blocked(query: &DnsQuery) -> Self {
        let mut data = Vec::with_capacity(MAX_DNS_PACKET_SIZE);

        // Header
        data.extend_from_slice(&query.id.to_be_bytes());
        let flags = flags::QR_RESPONSE
            | flags::AA_AUTHORITATIVE
            | (query.flags & flags::RD_RECURSION_DESIRED)
            | flags::RA_RECURSION_AVAILABLE
            | flags::RCODE_NXDOMAIN;
        data.extend_from_slice(&flags.to_be_bytes());
        data.extend_from_slice(&1u16.to_be_bytes()); // QDCOUNT
        data.extend_from_slice(&0u16.to_be_bytes()); // ANCOUNT
        data.extend_from_slice(&0u16.to_be_bytes()); // NSCOUNT
        data.extend_from_slice(&0u16.to_be_bytes()); // ARCOUNT

        // Copy question section from original query
        if query.raw.len() > 12 {
            // Find end of question section
            let mut offset = 12;
            while offset < query.raw.len() && query.raw[offset] != 0 {
                let len = query.raw[offset] as usize;
                if len & 0xC0 == 0xC0 {
                    offset += 2;
                    break;
                }
                offset += 1 + len;
            }
            if offset < query.raw.len() {
                offset += 5; // null terminator + qtype + qclass
            }
            if offset <= query.raw.len() {
                data.extend_from_slice(&query.raw[12..offset]);
            }
        }

        Self { data }
    }

    /// Create a success response with answers.
    fn success(query: &DnsQuery, values: &[String], ttl: u32) -> Self {
        let mut data = Vec::with_capacity(MAX_DNS_PACKET_SIZE);

        let answer_count = values.len().min(10) as u16; // Limit answers

        // Header
        data.extend_from_slice(&query.id.to_be_bytes());
        let flags = flags::QR_RESPONSE
            | (query.flags & flags::RD_RECURSION_DESIRED)
            | flags::RA_RECURSION_AVAILABLE
            | flags::RCODE_NOERROR;
        data.extend_from_slice(&flags.to_be_bytes());
        data.extend_from_slice(&1u16.to_be_bytes()); // QDCOUNT
        data.extend_from_slice(&answer_count.to_be_bytes()); // ANCOUNT
        data.extend_from_slice(&0u16.to_be_bytes()); // NSCOUNT
        data.extend_from_slice(&0u16.to_be_bytes()); // ARCOUNT

        // Copy question section
        let question_end = Self::find_question_end(&query.raw);
        if question_end <= query.raw.len() {
            data.extend_from_slice(&query.raw[12..question_end]);
        }

        // Add answer records
        for value in values.iter().take(10) {
            // Name pointer to question (offset 12)
            data.extend_from_slice(&[0xC0, 0x0C]);

            // Type and class
            data.extend_from_slice(&query.qtype.to_be_bytes());
            data.extend_from_slice(&query.qclass.to_be_bytes());

            // TTL
            data.extend_from_slice(&ttl.to_be_bytes());

            // RDATA
            match query.qtype {
                record_types::A => {
                    if let Ok(ip) = value.parse::<std::net::Ipv4Addr>() {
                        data.extend_from_slice(&4u16.to_be_bytes()); // RDLENGTH
                        data.extend_from_slice(&ip.octets());
                    }
                }
                record_types::AAAA => {
                    if let Ok(ip) = value.parse::<std::net::Ipv6Addr>() {
                        data.extend_from_slice(&16u16.to_be_bytes()); // RDLENGTH
                        data.extend_from_slice(&ip.octets());
                    }
                }
                record_types::TXT => {
                    let txt_bytes = value.as_bytes();
                    let len = txt_bytes.len().min(255);
                    data.extend_from_slice(&((len + 1) as u16).to_be_bytes()); // RDLENGTH
                    data.push(len as u8);
                    data.extend_from_slice(&txt_bytes[..len]);
                }
                _ => {
                    // For other types, skip
                }
            }
        }

        Self { data }
    }

    /// Create a SERVFAIL response.
    fn servfail(query: &DnsQuery) -> Self {
        let mut data = Vec::with_capacity(MAX_DNS_PACKET_SIZE);

        // Header
        data.extend_from_slice(&query.id.to_be_bytes());
        let flags = flags::QR_RESPONSE
            | (query.flags & flags::RD_RECURSION_DESIRED)
            | flags::RA_RECURSION_AVAILABLE
            | 0x0002; // SERVFAIL
        data.extend_from_slice(&flags.to_be_bytes());
        data.extend_from_slice(&1u16.to_be_bytes()); // QDCOUNT
        data.extend_from_slice(&0u16.to_be_bytes()); // ANCOUNT
        data.extend_from_slice(&0u16.to_be_bytes()); // NSCOUNT
        data.extend_from_slice(&0u16.to_be_bytes()); // ARCOUNT

        // Copy question section
        let question_end = Self::find_question_end(&query.raw);
        if question_end <= query.raw.len() {
            data.extend_from_slice(&query.raw[12..question_end]);
        }

        Self { data }
    }

    /// Find the end of the question section in a DNS packet.
    fn find_question_end(packet: &[u8]) -> usize {
        let mut offset = 12;
        while offset < packet.len() {
            let len = packet[offset] as usize;
            if len == 0 {
                return offset + 5; // null + qtype(2) + qclass(2)
            }
            if len & 0xC0 == 0xC0 {
                return offset + 6; // pointer(2) + qtype(2) + qclass(2)
            }
            offset += 1 + len;
        }
        packet.len()
    }

    /// Get the response bytes.
    fn to_bytes(&self) -> &[u8] {
        &self.data
    }
}

/// Start a DNS server in the background.
pub async fn start_dns_server(
    listen_addr: SocketAddr,
    resolver: Arc<DnsResolver>,
    blocker: Arc<AdBlocker>,
    stats: Arc<StatsCounter>,
) -> Result<broadcast::Sender<()>> {
    let server = DnsServer::new(listen_addr, resolver, blocker, stats);
    let shutdown_handle = server.shutdown_handle();

    tokio::spawn(async move {
        if let Err(e) = server.run().await {
            tracing::error!("DNS server error: {}", e);
        }
    });

    Ok(shutdown_handle)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_dns_query() {
        // Sample DNS query for "example.com" type A
        let packet: Vec<u8> = vec![
            0x12, 0x34, // ID
            0x01, 0x00, // Flags (RD=1)
            0x00, 0x01, // QDCOUNT
            0x00, 0x00, // ANCOUNT
            0x00, 0x00, // NSCOUNT
            0x00, 0x00, // ARCOUNT
            // Question: example.com
            0x07, b'e', b'x', b'a', b'm', b'p', b'l', b'e', 0x03, b'c', b'o', b'm', 0x00,
            0x00, 0x01, // QTYPE = A
            0x00, 0x01, // QCLASS = IN
        ];

        let query = DnsQuery::parse(&packet).unwrap();
        assert_eq!(query.id, 0x1234);
        assert_eq!(query.name, "example.com");
        assert_eq!(query.qtype, 1);
        assert_eq!(query.qclass, 1);
    }

    #[test]
    fn test_blocked_response() {
        let packet: Vec<u8> = vec![
            0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x07, b'e',
            b'x', b'a', b'm', b'p', b'l', b'e', 0x03, b'c', b'o', b'm', 0x00, 0x00, 0x01, 0x00,
            0x01,
        ];

        let query = DnsQuery::parse(&packet).unwrap();
        let response = DnsResponse::blocked(&query);
        let data = response.to_bytes();

        // Check response ID matches
        assert_eq!(data[0], 0x12);
        assert_eq!(data[1], 0x34);

        // Check QR bit is set (response)
        assert!(data[2] & 0x80 != 0);

        // Check RCODE is NXDOMAIN (3)
        assert_eq!(data[3] & 0x0F, 3);
    }
}
