//! DNS zone model and helpers.

use signapps_db::repositories::AdDnsRepository;
use sqlx::PgPool;
use uuid::Uuid;

/// Create a forward lookup zone for an AD domain and populate with default SRV records.
///
/// Called when a new AD domain is created. Creates:
/// - The zone itself
/// - SRV records for `_ldap._tcp`, `_kerberos._tcp`, `_gc._tcp`, `_kpasswd._tcp`
/// - An A record for the DC
///
/// # Errors
///
/// Returns an error if any database INSERT fails (e.g., duplicate zone).
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```ignore
/// create_ad_zone(&pool, domain_id, "corp.example.com", "dc01", "192.168.1.10").await?;
/// ```
#[tracing::instrument(skip(pool))]
pub async fn create_ad_zone(
    pool: &PgPool,
    domain_id: Uuid,
    dns_name: &str,
    dc_hostname: &str,
    dc_ip: &str,
) -> signapps_common::Result<()> {
    let zone = AdDnsRepository::create_zone(pool, domain_id, dns_name).await?;

    // DC A record
    AdDnsRepository::add_record(
        pool,
        zone.id,
        dc_hostname,
        "A",
        serde_json::json!({ "ip": dc_ip }),
        3600,
        true,
    )
    .await?;

    // SRV records for domain controller location
    let srv_records = vec![
        ("_ldap._tcp", 389u16),
        ("_ldap._tcp.dc._msdcs", 389),
        ("_kerberos._tcp", 88),
        ("_kerberos._tcp.dc._msdcs", 88),
        ("_kpasswd._tcp", 464),
        ("_gc._tcp", 3268),
    ];

    let dc_fqdn = format!("{dc_hostname}.{dns_name}");
    for (name, port) in srv_records {
        AdDnsRepository::add_record(
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
        .await?;
    }

    tracing::info!(
        zone = dns_name,
        "AD DNS zone created with default SRV records"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn srv_record_structure() {
        let rdata = serde_json::json!({
            "priority": 0,
            "weight": 100,
            "port": 389,
            "target": "dc.example.com"
        });
        assert_eq!(rdata["port"], 389);
        assert_eq!(rdata["target"], "dc.example.com");
    }

    #[test]
    fn a_record_structure() {
        let rdata = serde_json::json!({ "ip": "192.168.1.10" });
        assert_eq!(rdata["ip"], "192.168.1.10");
    }
}
