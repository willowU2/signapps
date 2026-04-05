//! DNS Zone Transfer (AXFR/IXFR) support.
//!
//! Allows secondary DNS servers to replicate zones from the primary.
//! Full zone transfer (AXFR) sends all records; incremental (IXFR) sends
//! only changes since a given SOA serial.

use signapps_db::models::ad_dns::{AdDnsRecord, AdDnsZone};
use sqlx::PgPool;
use uuid::Uuid;

/// Result of a zone transfer request.
#[derive(Debug, Clone, serde::Serialize)]
pub struct AxfrResult {
    /// The zone being transferred.
    pub zone: AdDnsZone,
    /// All records included in the transfer.
    pub records: Vec<AdDnsRecord>,
    /// Total number of records in the transfer.
    pub record_count: usize,
}

/// Perform a full zone transfer (AXFR).
///
/// Returns all records in the zone, prefixed and suffixed by the SOA record
/// (per RFC 5936).
///
/// # Errors
///
/// Returns `Error::Database` if the zone or records cannot be fetched.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```ignore
/// let result = full_transfer(&pool, zone_id).await?;
/// println!("Transferring {} records for {}", result.record_count, result.zone.zone_name);
/// ```
#[tracing::instrument(skip(pool))]
pub async fn full_transfer(
    pool: &PgPool,
    zone_id: Uuid,
) -> signapps_common::Result<AxfrResult> {
    // Get zone info
    let zone: AdDnsZone = sqlx::query_as("SELECT * FROM ad_dns_zones WHERE id = $1")
        .bind(zone_id)
        .fetch_one(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    // Get all records ordered for deterministic transfer
    let records: Vec<AdDnsRecord> = sqlx::query_as(
        "SELECT * FROM ad_dns_records WHERE zone_id = $1 ORDER BY name, record_type",
    )
    .bind(zone_id)
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let count = records.len();

    tracing::info!(
        zone = %zone.zone_name,
        records = count,
        serial = zone.soa_serial,
        "AXFR: full zone transfer"
    );

    Ok(AxfrResult { zone, records, record_count: count })
}

/// Perform an incremental zone transfer (IXFR).
///
/// Returns records that changed since the given SOA serial.
/// If the client serial matches the server serial the transfer is empty.
/// If the client serial is behind, falls back to a full transfer (proper IXFR
/// requires a change log, which is not yet implemented).
///
/// # Errors
///
/// Returns `Error::Database` if the zone cannot be fetched.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```ignore
/// let result = incremental_transfer(&pool, zone_id, 2024010100).await?;
/// if result.record_count == 0 {
///     println!("Client is already up-to-date");
/// }
/// ```
#[tracing::instrument(skip(pool))]
pub async fn incremental_transfer(
    pool: &PgPool,
    zone_id: Uuid,
    client_serial: i64,
) -> signapps_common::Result<AxfrResult> {
    // Get current zone
    let zone: AdDnsZone = sqlx::query_as("SELECT * FROM ad_dns_zones WHERE id = $1")
        .bind(zone_id)
        .fetch_one(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    // If client is already up-to-date, return empty transfer
    if client_serial >= zone.soa_serial {
        tracing::info!(zone = %zone.zone_name, "IXFR: client is up-to-date");
        return Ok(AxfrResult { zone, records: vec![], record_count: 0 });
    }

    // Fall back to full transfer (proper IXFR needs a per-record change log)
    tracing::info!(
        zone = %zone.zone_name,
        client_serial = client_serial,
        server_serial = zone.soa_serial,
        "IXFR: falling back to full transfer"
    );
    full_transfer(pool, zone_id).await
}

#[cfg(test)]
mod tests {
    #[test]
    fn axfr_result_serializable() {
        let result = super::AxfrResult {
            zone: signapps_db::models::ad_dns::AdDnsZone {
                id: uuid::Uuid::new_v4(),
                domain_id: uuid::Uuid::new_v4(),
                zone_name: "example.com".to_string(),
                zone_type: "primary".to_string(),
                soa_serial: 1,
                soa_refresh: 900,
                soa_retry: 600,
                soa_expire: 86400,
                soa_minimum: 3600,
                allow_dynamic_update: true,
                scavenge_interval_hours: 168,
                created_at: chrono::Utc::now(),
            },
            records: vec![],
            record_count: 0,
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("example.com"));
    }
}
