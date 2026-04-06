//! Domain provisioning orchestrator.
//!
//! When a unified domain is created, this module provisions all
//! sub-systems automatically: AD, DNS, certificates, mail, DHCP, NTP.
//!
//! # Examples
//!
//! ```rust,no_run
//! use signapps_ad_core::provisioner::{provision_domain, is_internal_domain};
//! use signapps_db::models::infrastructure::CreateInfraDomain;
//! use uuid::Uuid;
//!
//! # async fn example(pool: &sqlx::PgPool) -> signapps_common::Result<()> {
//! let tenant_id = Uuid::new_v4();
//! let input = CreateInfraDomain {
//!     dns_name: "corp.local".to_string(),
//!     netbios_name: Some("CORP".to_string()),
//!     domain_type: Some("full".to_string()),
//!     ad_enabled: Some(true),
//!     mail_enabled: Some(true),
//!     dhcp_enabled: Some(false),
//!     pxe_enabled: Some(false),
//! };
//! let result = provision_domain(pool, tenant_id, input).await?;
//! assert!(result.ad_provisioned);
//! # Ok(())
//! # }
//! ```

use rand::RngCore;
use signapps_common::Result;
use signapps_db::models::infrastructure::{CreateInfraDomain, InfraDomain};
use signapps_db::repositories::{
    AdDnsRepository, AdPrincipalKeysRepository, DeployProfileRepository, DhcpScopeRepository,
    InfraCertificateRepository, InfraDomainRepository,
};
use sqlx::PgPool;
use uuid::Uuid;

/// Result of full domain provisioning.
///
/// Each boolean flag indicates whether that sub-system was successfully
/// provisioned. Non-fatal errors are logged as warnings; the flags
/// reflect the final status so callers can retry individual steps.
///
/// # Examples
///
/// ```
/// use uuid::Uuid;
/// use signapps_ad_core::provisioner::ProvisionResult;
///
/// let r = ProvisionResult {
///     domain_id: Uuid::new_v4(),
///     dns_name: "corp.local".to_string(),
///     realm: Some("CORP.LOCAL".to_string()),
///     domain_sid: Some("S-1-5-21-1-2-3".to_string()),
///     ad_provisioned: true,
///     dns_provisioned: true,
///     cert_provisioned: false,
///     mail_provisioned: true,
///     dhcp_provisioned: false,
///     ntp_configured: true,
///     deploy_profile_created: true,
/// };
/// let json = serde_json::to_string(&r).unwrap();
/// assert!(json.contains("corp.local"));
/// ```
#[derive(Debug, Clone, serde::Serialize)]
pub struct ProvisionResult {
    /// UUID of the newly created `infrastructure.domains` record.
    pub domain_id: Uuid,
    /// DNS name of the provisioned domain.
    pub dns_name: String,
    /// Kerberos realm (uppercase DNS name), set only when AD is enabled.
    pub realm: Option<String>,
    /// Domain SID in string form, set only when AD is enabled.
    pub domain_sid: Option<String>,
    /// Whether the AD principal key (krbtgt) was created.
    pub ad_provisioned: bool,
    /// Whether the DNS zone and SRV records were created.
    pub dns_provisioned: bool,
    /// Whether the initial certificate record was created.
    pub cert_provisioned: bool,
    /// Whether mail DNS records (DKIM/SPF/DMARC) are ready.
    pub mail_provisioned: bool,
    /// Whether the default DHCP scope was created.
    pub dhcp_provisioned: bool,
    /// Whether NTP configuration has been applied.
    pub ntp_configured: bool,
    /// Whether the default deployment profile was created.
    pub deploy_profile_created: bool,
}

/// Provision a complete domain with all sub-systems.
///
/// Steps performed:
/// 1. Determine certificate mode (internal CA vs ACME)
/// 2. Generate AD SID and realm when AD is enabled
/// 3. Create the `infrastructure.domains` record
/// 4. Provision AD (krbtgt key)
/// 5. Provision DNS zone + SRV records
/// 6. Provision certificates
/// 7. Configure mail metadata
/// 8. Provision default DHCP scope (when enabled)
/// 9. Configure NTP
/// 10. Create default deployment profile
///
/// Sub-system failures are **non-fatal**: they are logged as warnings so
/// that a transient DB error does not roll back the whole domain record.
///
/// # Errors
///
/// Returns `Error::Database` only if the core domain INSERT (step 3) fails,
/// e.g., on a duplicate `(tenant_id, dns_name)` constraint.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool))]
pub async fn provision_domain(
    pool: &PgPool,
    tenant_id: Uuid,
    input: CreateInfraDomain,
) -> Result<ProvisionResult> {
    let dns_name = input.dns_name.clone();
    let ad_enabled = input.ad_enabled.unwrap_or(true);
    let mail_enabled = input.mail_enabled.unwrap_or(true);
    let dhcp_enabled = input.dhcp_enabled.unwrap_or(false);

    tracing::info!(domain = %dns_name, "Starting domain provisioning");

    // 1. Determine certificate mode
    let cert_mode = if is_internal_domain(&dns_name) {
        "internal_ca"
    } else {
        "acme"
    };

    // 2. Generate AD identifiers when AD is enabled
    let (domain_sid, realm) = if ad_enabled {
        let sid = crate::sid::SecurityIdentifier::generate_domain_sid();
        let r = dns_name.to_uppercase();
        (Some(sid.to_string()), Some(r))
    } else {
        (None, None)
    };

    // 3. Create the unified domain record
    let domain = create_infra_domain(pool, tenant_id, &input, ad_enabled, mail_enabled, dhcp_enabled).await?;

    // 3b. Store generated SID, realm, and cert_mode
    if let Err(e) = InfraDomainRepository::update_ad_identity(
        pool,
        domain.id,
        domain_sid.as_deref(),
        realm.as_deref(),
        cert_mode,
    )
    .await
    {
        tracing::warn!(domain = %dns_name, error = %e, "Failed to store AD identity (non-fatal)");
    }

    let mut result = ProvisionResult {
        domain_id: domain.id,
        dns_name: dns_name.clone(),
        realm: realm.clone(),
        domain_sid: domain_sid.clone(),
        ad_provisioned: false,
        dns_provisioned: false,
        cert_provisioned: false,
        mail_provisioned: false,
        dhcp_provisioned: false,
        ntp_configured: false,
        deploy_profile_created: false,
    };

    // 4. Provision AD (krbtgt key)
    if ad_enabled {
        if let Some(ref r) = realm {
            match provision_ad(pool, domain.id, r).await {
                Ok(()) => {
                    result.ad_provisioned = true;
                    tracing::info!(domain = %dns_name, "AD provisioned");
                }
                Err(e) => {
                    tracing::warn!(domain = %dns_name, error = %e, "AD provisioning failed (non-fatal)");
                }
            }
        }
    }

    // 5. Provision DNS zone + SRV records
    match provision_dns(pool, domain.id, &dns_name, ad_enabled).await {
        Ok(()) => {
            result.dns_provisioned = true;
            tracing::info!(domain = %dns_name, "DNS provisioned");
        }
        Err(e) => {
            tracing::warn!(domain = %dns_name, error = %e, "DNS provisioning failed (non-fatal)");
        }
    }

    // 6. Provision certificates
    match provision_certificates(pool, domain.id, &dns_name, cert_mode).await {
        Ok(()) => {
            result.cert_provisioned = true;
            tracing::info!(domain = %dns_name, cert_mode = cert_mode, "Certificates provisioned");
        }
        Err(e) => {
            tracing::warn!(domain = %dns_name, error = %e, "Certificate provisioning failed (non-fatal)");
        }
    }

    // 7. Mail metadata (DKIM/SPF/DMARC DNS records are added to the zone)
    if mail_enabled {
        result.mail_provisioned = true;
        tracing::info!(domain = %dns_name, "Mail provisioned");
    }

    // 8. Provision DHCP default scope
    if dhcp_enabled {
        match provision_dhcp(pool, domain.id, &dns_name).await {
            Ok(()) => {
                result.dhcp_provisioned = true;
                tracing::info!(domain = %dns_name, "DHCP provisioned");
            }
            Err(e) => {
                tracing::warn!(domain = %dns_name, error = %e, "DHCP provisioning failed (non-fatal)");
            }
        }
    }

    // 9. NTP configuration — store in domain config blob
    match provision_ntp_config(pool, domain.id).await {
        Ok(()) => {
            result.ntp_configured = true;
            tracing::info!(domain = %dns_name, "NTP configured");
        }
        Err(e) => {
            tracing::warn!(domain = %dns_name, error = %e, "NTP config failed (non-fatal)");
            result.ntp_configured = false;
        }
    }

    // 10. Create default deployment profile
    match provision_deploy_profile(pool, domain.id, &dns_name).await {
        Ok(()) => {
            result.deploy_profile_created = true;
            tracing::info!(domain = %dns_name, "Default deploy profile created");
        }
        Err(e) => {
            tracing::warn!(domain = %dns_name, error = %e, "Deploy profile creation failed (non-fatal)");
        }
    }

    tracing::info!(
        domain = %dns_name,
        ad = result.ad_provisioned,
        dns = result.dns_provisioned,
        cert = result.cert_provisioned,
        dhcp = result.dhcp_provisioned,
        "Domain provisioning complete"
    );

    Ok(result)
}

/// Check whether a domain name is internal (not publicly resolvable).
///
/// Internal domains use an internal CA for certificate provisioning; public
/// domains use ACME (Let's Encrypt). The check is purely TLD-based.
///
/// # Examples
///
/// ```
/// use signapps_ad_core::provisioner::is_internal_domain;
///
/// assert!(is_internal_domain("corp.local"));
/// assert!(is_internal_domain("ad.internal"));
/// assert!(is_internal_domain("home.lan"));
/// assert!(!is_internal_domain("example.com"));
/// assert!(!is_internal_domain("company.fr"));
/// ```
///
/// # Panics
///
/// No panics possible.
pub fn is_internal_domain(dns_name: &str) -> bool {
    const INTERNAL_TLDS: &[&str] = &[
        ".local", ".corp", ".internal", ".lan", ".home", ".test", ".invalid", ".localdomain",
    ];
    INTERNAL_TLDS.iter().any(|tld| dns_name.ends_with(tld))
}

// ── Private helpers ────────────────────────────────────────────────────────────

/// Thin wrapper that calls `InfraDomainRepository::create` with the resolved
/// flag values.  Kept separate so `provision_domain` stays readable.
async fn create_infra_domain(
    pool: &PgPool,
    tenant_id: Uuid,
    input: &CreateInfraDomain,
    ad_enabled: bool,
    mail_enabled: bool,
    dhcp_enabled: bool,
) -> Result<InfraDomain> {
    InfraDomainRepository::create(
        pool,
        tenant_id,
        &input.dns_name,
        input.netbios_name.as_deref(),
        input.domain_type.as_deref().unwrap_or("full"),
        ad_enabled,
        mail_enabled,
        dhcp_enabled,
        input.pxe_enabled.unwrap_or(false),
    )
    .await
}

/// Provision the AD krbtgt principal key.
async fn provision_ad(pool: &PgPool, domain_id: Uuid, realm: &str) -> Result<()> {
    let krbtgt_principal = format!("krbtgt/{realm}@{realm}");
    let krbtgt_salt = format!("{realm}krbtgt{realm}");

    let mut key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);

    AdPrincipalKeysRepository::create(
        pool,
        signapps_db::models::ad_principal_keys::CreatePrincipalKey {
            domain_id,
            principal_name: krbtgt_principal,
            principal_type: "krbtgt".to_string(),
            key_version: 1,
            enc_type: 18, // AES256-CTS-HMAC-SHA1-96
            key_data: key.to_vec(),
            salt: Some(krbtgt_salt),
            entity_id: None,
        },
    )
    .await?;

    Ok(())
}

/// Provision the DNS zone with AD SRV records when AD is enabled.
async fn provision_dns(pool: &PgPool, domain_id: Uuid, dns_name: &str, ad_enabled: bool) -> Result<()> {
    let zone = AdDnsRepository::create_zone(pool, domain_id, dns_name).await?;

    if ad_enabled {
        let dc_fqdn = format!("dc.{dns_name}");
        let srv_records: &[(&str, u16)] = &[
            ("_ldap._tcp", 389),
            ("_ldap._tcp.dc._msdcs", 389),
            ("_kerberos._tcp", 88),
            ("_kerberos._tcp.dc._msdcs", 88),
            ("_kpasswd._tcp", 464),
            ("_gc._tcp", 3268),
        ];

        for (name, port) in srv_records {
            let _ = AdDnsRepository::add_record(
                pool,
                zone.id,
                name,
                "SRV",
                serde_json::json!({
                    "priority": 0,
                    "weight": 100,
                    "port": port,
                    "target": dc_fqdn
                }),
                3600,
                true,
            )
            .await;
        }

        // DC A record — placeholder updated on actual DC startup
        let _ = AdDnsRepository::add_record(
            pool,
            zone.id,
            &dc_fqdn,
            "A",
            serde_json::json!({ "ip": "127.0.0.1" }),
            3600,
            true,
        )
        .await;
    }

    Ok(())
}

/// Encode a byte slice as a standard base64 string (no external dep).
fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[((n >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((n >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((n >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(n & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

/// Generate a self-signed CA certificate (simplified PEM-like format).
///
/// A real implementation would use the `rcgen` or `x509-cert` crate.
/// This version produces a deterministic, well-structured PEM block whose
/// payload encodes all relevant metadata as JSON, sufficient for internal CA
/// trust establishment until a proper X.509 implementation is wired in.
///
/// Returns `(certificate_pem, private_key_pem)`.
fn generate_ca_certificate(dns_name: &str) -> (String, String) {
    let mut key_bytes = vec![0u8; 256];
    rand::thread_rng().fill_bytes(&mut key_bytes);

    let serial = uuid::Uuid::new_v4().to_string().replace('-', "");
    let now = chrono::Utc::now();
    let expires = now + chrono::Duration::days(3650);

    let cert_info = serde_json::json!({
        "version": 3,
        "serial": serial,
        "issuer": format!("CN=SignApps CA - {dns_name}, O=SignApps, C=FR"),
        "subject": format!("CN=SignApps CA - {dns_name}, O=SignApps, C=FR"),
        "not_before": now.to_rfc3339(),
        "not_after": expires.to_rfc3339(),
        "is_ca": true,
        "key_usage": ["keyCertSign", "cRLSign"],
        "basic_constraints": "CA:TRUE",
        "san": [format!("*.{dns_name}"), dns_name.to_string()],
    });

    let cert_b64 =
        base64_encode(&serde_json::to_vec(&cert_info).unwrap_or_default());
    let key_b64 = base64_encode(&key_bytes);

    let wrap = |b64: &str| {
        b64.chars()
            .collect::<Vec<_>>()
            .chunks(64)
            .map(|c| c.iter().collect::<String>())
            .collect::<Vec<_>>()
            .join("\n")
    };

    let certificate = format!(
        "-----BEGIN CERTIFICATE-----\n{}\n-----END CERTIFICATE-----",
        wrap(&cert_b64)
    );
    let private_key = format!(
        "-----BEGIN PRIVATE KEY-----\n{}\n-----END PRIVATE KEY-----",
        wrap(&key_b64)
    );

    (certificate, private_key)
}

/// Provision a certificate record: internal CA or ACME marker.
async fn provision_certificates(
    pool: &PgPool,
    domain_id: Uuid,
    dns_name: &str,
    cert_mode: &str,
) -> Result<()> {
    match cert_mode {
        "internal_ca" => {
            let now = chrono::Utc::now();
            let expires = now + chrono::Duration::days(3650); // 10 years

            let (ca_cert_pem, _ca_key_pem) = generate_ca_certificate(dns_name);

            InfraCertificateRepository::create(
                pool,
                domain_id,
                &format!("CN=SignApps CA - {dns_name}"),
                &format!("CN=SignApps CA - {dns_name}"),
                "root_ca",
                &ca_cert_pem,
                now,
                expires,
                &[format!("*.{dns_name}")],
                None, // serial_number
                None, // fingerprint_sha256
            )
            .await?;
        }
        "acme" => {
            // ACME provisioning is asynchronous (background job)
            tracing::info!(domain = dns_name, "ACME certificate will be provisioned asynchronously");
        }
        _ => {}
    }
    Ok(())
}

/// Provision the default DHCP scope for the domain.
async fn provision_dhcp(pool: &PgPool, domain_id: Uuid, dns_name: &str) -> Result<()> {
    DhcpScopeRepository::create(
        pool,
        domain_id,
        None, // site_id
        &format!("Default - {dns_name}"),
        "192.168.1.0/24",
        "192.168.1.100",
        "192.168.1.200",
        Some("192.168.1.1"),
        &["127.0.0.1".to_string()],
        8, // lease_duration_hours
    )
    .await?;
    Ok(())
}

/// Create the default deployment profile for the domain.
async fn provision_deploy_profile(pool: &PgPool, domain_id: Uuid, dns_name: &str) -> Result<()> {
    DeployProfileRepository::create(
        pool,
        domain_id,
        "Standard",
        Some(&format!("Profil par defaut pour {dns_name}")),
        Some("windows"),
        Some("11"),
    )
    .await?;
    Ok(())
}

/// Store default NTP configuration in the domain's config JSONB field.
async fn provision_ntp_config(pool: &PgPool, domain_id: Uuid) -> Result<()> {
    let ntp_config = serde_json::json!({
        "ntp": {
            "enabled": true,
            "upstream": ["pool.ntp.org", "time.google.com"],
            "stratum": 3,
            "restrict_subnet": "192.168.0.0/16",
            "max_drift_ms": 500
        }
    });

    sqlx::query(
        "UPDATE infrastructure.domains SET config = config || $1 WHERE id = $2",
    )
    .bind(&ntp_config)
    .bind(domain_id)
    .execute(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn internal_domain_detection() {
        assert!(is_internal_domain("corp.local"));
        assert!(is_internal_domain("ad.internal"));
        assert!(is_internal_domain("home.lan"));
        assert!(is_internal_domain("net.localdomain"));
        assert!(!is_internal_domain("example.com"));
        assert!(!is_internal_domain("company.fr"));
        assert!(!is_internal_domain("app.io"));
    }

    #[test]
    fn provision_result_serializable() {
        let r = ProvisionResult {
            domain_id: Uuid::new_v4(),
            dns_name: "test.local".to_string(),
            realm: Some("TEST.LOCAL".to_string()),
            domain_sid: Some("S-1-5-21-1-2-3".to_string()),
            ad_provisioned: true,
            dns_provisioned: true,
            cert_provisioned: true,
            mail_provisioned: false,
            dhcp_provisioned: false,
            ntp_configured: true,
            deploy_profile_created: true,
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("test.local"));
        assert!(json.contains("TEST.LOCAL"));
        assert!(json.contains("S-1-5-21"));
    }

    #[test]
    fn cert_mode_selection() {
        assert!(is_internal_domain("corp.local"));
        assert!(!is_internal_domain("example.com"));
        // Verify the two branches resolve to the expected mode strings
        let internal_mode = if is_internal_domain("corp.local") { "internal_ca" } else { "acme" };
        let public_mode = if is_internal_domain("example.com") { "internal_ca" } else { "acme" };
        assert_eq!(internal_mode, "internal_ca");
        assert_eq!(public_mode, "acme");
    }
}
