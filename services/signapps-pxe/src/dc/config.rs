//! Domain Controller configuration.

use signapps_common::bootstrap::env_or;

/// Domain Controller configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct DcConfig {
    /// DNS domain name (e.g., "example.com").
    pub domain: String,
    /// Kerberos realm (e.g., "EXAMPLE.COM").
    pub realm: String,
    /// NetBIOS name (e.g., "EXAMPLE").
    #[allow(dead_code)]
    pub netbios: String,
    /// LDAP port (default: 389).
    pub ldap_port: u16,
    /// LDAPS port (default: 636).
    pub ldaps_port: u16,
    /// Kerberos KDC port (default: 88).
    pub kdc_port: u16,
    /// kpasswd port (default: 464).
    pub kpasswd_port: u16,
    /// DHCP server port (default: 6767 — non-privileged, real DHCP is 67).
    #[allow(dead_code)]
    pub dhcp_port: u16,
    /// NTP server port (default: 10123 — non-privileged, real NTP is 123).
    pub ntp_port: u16,
    /// Require TLS for LDAP connections.
    #[allow(dead_code)]
    pub require_tls: bool,
    /// Maximum clock skew for Kerberos (seconds, default: 300).
    #[allow(dead_code)]
    pub max_clock_skew: u64,
}

impl DcConfig {
    /// Load configuration from environment variables.
    pub fn from_env() -> Self {
        let domain = env_or("DC_DOMAIN", "example.com");
        let realm = env_or("DC_REALM", &domain.to_uppercase());
        Self {
            domain: domain.clone(),
            realm,
            netbios: env_or(
                "DC_NETBIOS",
                &domain.split('.').next().unwrap_or("DC").to_uppercase(),
            ),
            ldap_port: env_or("DC_LDAP_PORT", "389").parse().unwrap_or(389),
            ldaps_port: env_or("DC_LDAPS_PORT", "636").parse().unwrap_or(636),
            kdc_port: env_or("DC_KDC_PORT", "88").parse().unwrap_or(88),
            kpasswd_port: env_or("DC_KPASSWD_PORT", "464").parse().unwrap_or(464),
            dhcp_port: env_or("DC_DHCP_PORT", "6767").parse().unwrap_or(6767),
            ntp_port: env_or("DC_NTP_PORT", "10123").parse().unwrap_or(10123),
            require_tls: env_or("DC_REQUIRE_TLS", "false").parse().unwrap_or(false),
            max_clock_skew: env_or("DC_MAX_CLOCK_SKEW", "300").parse().unwrap_or(300),
        }
    }
}
