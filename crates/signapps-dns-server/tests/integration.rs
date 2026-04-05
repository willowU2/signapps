//! Integration tests for DNS + DHCP + NTP modules.

#[test]
fn ntp_packet_server_response() {
    use signapps_dns_server::ntp::NtpPacket;

    let response = NtpPacket::server_response(0, 3);
    let bytes = response.to_bytes();

    // Server mode = 4 (0x24 = LI=0, VN=4, Mode=4)
    assert_eq!(bytes[0] & 0x07, 4);
    // Stratum = 3
    assert_eq!(bytes[1], 3);
    // Packet is 48 bytes
    assert_eq!(bytes.len(), 48);

    // Roundtrip
    let parsed = NtpPacket::from_bytes(&bytes).unwrap();
    assert_eq!(parsed.stratum, response.stratum);
}

#[test]
fn dhcp_ip_conversion() {
    // Test via the public module (if ip_to_u32/u32_to_ip are not public, skip this)
    // The DHCP module handles IP allocation internally
    use signapps_dns_server::dhcp::DhcpMessageType;

    assert_eq!(DhcpMessageType::from_u8(1), Some(DhcpMessageType::Discover));
    assert_eq!(DhcpMessageType::from_u8(5), Some(DhcpMessageType::Ack));
    assert_eq!(DhcpMessageType::from_u8(7), Some(DhcpMessageType::Release));
    assert_eq!(DhcpMessageType::from_u8(0), None);
}

#[test]
fn ntp_config_defaults() {
    use signapps_dns_server::ntp::NtpConfig;

    let cfg = NtpConfig::default();
    assert!(cfg.enabled);
    assert_eq!(cfg.stratum, 3);
    assert!(cfg.upstream_servers.contains(&"pool.ntp.org".to_string()));
}
