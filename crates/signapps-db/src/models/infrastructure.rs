//! Infrastructure domain models — unified domain registry,
//! certificates, DHCP, and deployment profiles.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

// ── Domain Registry ──────────────────────────────────────────────────────────

/// Unified infrastructure domain — single source of truth replacing
/// `ad_domains` and `mailserver.domains`.
///
/// A domain can simultaneously serve AD, mail, DHCP, PXE, and NTP roles,
/// controlled by the `*_enabled` flags.
///
/// # Examples
///
/// ```rust,ignore
/// let domain = InfraDomain { dns_name: "corp.example.com".into(), ..Default::default() };
/// ```
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations
/// (e.g., duplicate `(tenant_id, dns_name)`).
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct InfraDomain {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Owning tenant.
    pub tenant_id: Uuid,
    /// Fully-qualified DNS name (e.g., `corp.example.com`).
    pub dns_name: String,
    /// NetBIOS short name (e.g., `CORP`), optional for DNS-only domains.
    pub netbios_name: Option<String>,
    /// Domain role: `full`, `dns_only`, `mail_only`, `internal`.
    pub domain_type: String,
    /// Whether Active Directory services are enabled.
    pub ad_enabled: bool,
    /// Whether mail services (SMTP/IMAP) are enabled.
    pub mail_enabled: bool,
    /// Whether DHCP server is enabled.
    pub dhcp_enabled: bool,
    /// Whether PXE boot services are enabled.
    pub pxe_enabled: bool,
    /// Whether NTP server is enabled.
    pub ntp_enabled: bool,
    /// AD domain SID (e.g., `S-1-5-21-…`).
    pub domain_sid: Option<String>,
    /// Kerberos realm (usually uppercased DNS name).
    pub realm: Option<String>,
    /// Whether this is the forest root domain.
    pub forest_root: bool,
    /// AD domain functional level (0=2000 … 7=2016+).
    pub domain_function_level: i32,
    /// AD tree identifier linking child domains to their root.
    pub tree_id: Option<Uuid>,
    /// Certificate provisioning mode: `auto`, `acme`, `internal_ca`, `manual`, `none`.
    pub cert_mode: String,
    /// DKIM selector name (default: `signapps`).
    pub dkim_selector: Option<String>,
    /// SPF TXT record value.
    pub spf_record: Option<String>,
    /// DMARC policy: `none`, `quarantine`, or `reject`.
    pub dmarc_policy: Option<String>,
    /// Arbitrary service-specific configuration blob.
    pub config: serde_json::Value,
    /// Whether the domain is currently active.
    pub is_active: bool,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last-updated timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Request payload to create a new infrastructure domain.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateInfraDomain {
    /// Fully-qualified DNS name.
    pub dns_name: String,
    /// Optional NetBIOS name.
    pub netbios_name: Option<String>,
    /// Domain type (defaults to `full`).
    pub domain_type: Option<String>,
    /// Enable AD services.
    pub ad_enabled: Option<bool>,
    /// Enable mail services.
    pub mail_enabled: Option<bool>,
    /// Enable DHCP services.
    pub dhcp_enabled: Option<bool>,
    /// Enable PXE boot services.
    pub pxe_enabled: Option<bool>,
}

// ── Certificates ─────────────────────────────────────────────────────────────

/// A TLS/PKI certificate managed under an infrastructure domain.
///
/// Covers CA roots, intermediates, server, client, and wildcard certificates.
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct InfraCertificate {
    /// Unique identifier.
    pub id: Uuid,
    /// Owning infrastructure domain.
    pub domain_id: Uuid,
    /// Certificate subject (CN or DN).
    pub subject: String,
    /// Certificate issuer (CN or DN).
    pub issuer: String,
    /// Certificate role: `root_ca`, `intermediate_ca`, `server`, `client`, `wildcard`.
    pub cert_type: String,
    /// PEM-encoded certificate.
    pub certificate: String,
    /// Validity start timestamp.
    pub not_before: DateTime<Utc>,
    /// Validity end timestamp.
    pub not_after: DateTime<Utc>,
    /// Whether the certificate should be renewed automatically before expiry.
    pub auto_renew: bool,
    /// Subject Alternative Names.
    pub san: Vec<String>,
    /// X.509 serial number (hex string).
    pub serial_number: Option<String>,
    /// SHA-256 fingerprint (hex string).
    pub fingerprint_sha256: Option<String>,
    /// Certificate status: `active`, `expired`, `revoked`, `pending`.
    pub status: String,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

// ── DHCP ─────────────────────────────────────────────────────────────────────

/// A DHCP address scope (subnet) under an infrastructure domain.
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct DhcpScope {
    /// Unique identifier.
    pub id: Uuid,
    /// Owning infrastructure domain.
    pub domain_id: Uuid,
    /// Optional site/location identifier.
    pub site_id: Option<Uuid>,
    /// Human-readable scope name.
    pub name: String,
    /// Network address in CIDR notation (e.g., `192.168.1.0/24`).
    pub subnet: String,
    /// First IP address in the dynamic range.
    pub range_start: String,
    /// Last IP address in the dynamic range.
    pub range_end: String,
    /// Default gateway IP.
    pub gateway: Option<String>,
    /// DNS server IP addresses to hand out.
    pub dns_servers: Vec<String>,
    /// NTP server IP addresses to hand out.
    pub ntp_servers: Vec<String>,
    /// DNS domain name suffix to hand out.
    pub domain_name: Option<String>,
    /// Lease duration in hours.
    pub lease_duration_hours: i32,
    /// PXE server IP or hostname.
    pub pxe_server: Option<String>,
    /// PXE boot filename (TFTP path).
    pub pxe_bootfile: Option<String>,
    /// Additional DHCP options as key/value pairs.
    pub options: serde_json::Value,
    /// Whether this scope is currently active.
    pub is_active: bool,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// An active DHCP lease granted to a client.
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct DhcpLease {
    /// Unique identifier.
    pub id: Uuid,
    /// Parent DHCP scope.
    pub scope_id: Uuid,
    /// Leased IP address.
    pub ip_address: String,
    /// Client MAC address.
    pub mac_address: String,
    /// Client-reported hostname.
    pub hostname: Option<String>,
    /// Linked computer record (if known).
    pub computer_id: Option<Uuid>,
    /// Lease grant timestamp.
    pub lease_start: DateTime<Utc>,
    /// Lease expiry timestamp.
    pub lease_end: DateTime<Utc>,
    /// Whether the lease is currently active (not expired or released).
    pub is_active: bool,
}

/// A static DHCP reservation (MAC → IP mapping).
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct DhcpReservation {
    /// Unique identifier.
    pub id: Uuid,
    /// Parent DHCP scope.
    pub scope_id: Uuid,
    /// Client MAC address to match.
    pub mac_address: String,
    /// Reserved IP address to assign.
    pub ip_address: String,
    /// Optional hostname to assign.
    pub hostname: Option<String>,
    /// Human-readable description.
    pub description: Option<String>,
    /// Linked computer record (if known).
    pub computer_id: Option<Uuid>,
}

// ── Deployment ────────────────────────────────────────────────────────────────

/// An OS deployment profile for PXE-booted machines.
///
/// Profiles are assigned to org nodes, groups, MAC addresses, or IP ranges,
/// and drive fully-automated OS installation and post-install configuration.
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct DeployProfile {
    /// Unique identifier.
    pub id: Uuid,
    /// Owning infrastructure domain.
    pub domain_id: Uuid,
    /// Display name.
    pub name: String,
    /// Optional description.
    pub description: Option<String>,
    /// OS family: `windows`, `linux`, `macos`, `custom`.
    pub os_type: Option<String>,
    /// OS version string (e.g., `Ubuntu 24.04 LTS`).
    pub os_version: Option<String>,
    /// URL to the OS installation image.
    pub os_image_url: Option<String>,
    /// Unattended/preseed/kickstart configuration blob.
    pub os_config: serde_json::Value,
    /// Package list to install post-OS (JSON array of names or objects).
    pub packages: serde_json::Value,
    /// Target Active Directory OU for computer objects.
    pub target_ou: Option<String>,
    /// GPO IDs to apply after domain join.
    pub gpo_ids: Vec<Uuid>,
    /// Post-install script paths (run in order).
    pub post_install_scripts: Vec<String>,
    /// PXE boot image filename (TFTP path).
    pub pxe_boot_image: Option<String>,
    /// Label shown in the PXE boot menu.
    pub pxe_menu_label: Option<String>,
    /// Optional DHCP scope to restrict this profile to.
    pub dhcp_scope_id: Option<Uuid>,
    /// Optional VLAN ID to assign.
    pub vlan_id: Option<i32>,
    /// Whether this is the default profile for its domain.
    pub is_default: bool,
    /// Display sort order.
    pub sort_order: i32,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last-updated timestamp.
    pub updated_at: DateTime<Utc>,
}

/// A deployment history record for a single machine installation.
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct DeployHistory {
    /// Unique identifier.
    pub id: Uuid,
    /// Profile used for this deployment.
    pub profile_id: Uuid,
    /// Linked computer record (populated after domain join).
    pub computer_id: Option<Uuid>,
    /// Client MAC address observed at PXE boot.
    pub mac_address: Option<String>,
    /// Hostname assigned during deployment.
    pub hostname: Option<String>,
    /// Deployment status: `pending`, `booting`, `installing`, `configuring`, `completed`, `failed`.
    pub status: String,
    /// Timestamp when the deployment started.
    pub started_at: Option<DateTime<Utc>>,
    /// Timestamp when the deployment completed (success or failure).
    pub completed_at: Option<DateTime<Utc>>,
    /// Error message if `status = 'failed'`.
    pub error_message: Option<String>,
    /// Full deployment log output.
    pub log: Option<String>,
    /// Record creation timestamp.
    pub created_at: DateTime<Utc>,
}
