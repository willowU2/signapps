//! Repository for AD-integrated DNS zones and records.

use chrono::{DateTime, Utc};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::ad_dns::{AdDnsRecord, AdDnsZone};

/// Repository for `ad_dns_zones` and `ad_dns_records` table operations.
pub struct AdDnsRepository;

impl AdDnsRepository {
    /// Create a DNS zone for an AD domain.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the INSERT fails (e.g., duplicate `domain_id` + `zone_name`).
    pub async fn create_zone(pool: &PgPool, domain_id: Uuid, zone_name: &str) -> Result<AdDnsZone> {
        let zone = sqlx::query_as::<_, AdDnsZone>(
            r#"
            INSERT INTO ad_dns_zones (domain_id, zone_name)
            VALUES ($1, $2)
            RETURNING *
            "#,
        )
        .bind(domain_id)
        .bind(zone_name)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(zone)
    }

    /// Get a DNS zone by domain and zone name.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn get_zone(
        pool: &PgPool,
        domain_id: Uuid,
        zone_name: &str,
    ) -> Result<Option<AdDnsZone>> {
        let zone = sqlx::query_as::<_, AdDnsZone>(
            "SELECT * FROM ad_dns_zones WHERE domain_id = $1 AND zone_name = $2",
        )
        .bind(domain_id)
        .bind(zone_name)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(zone)
    }

    /// Add a DNS record to a zone.
    ///
    /// Static records (`is_static = true`) receive a `NULL` timestamp; dynamic records
    /// receive the current UTC time to enable scavenging.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the INSERT fails.
    pub async fn add_record(
        pool: &PgPool,
        zone_id: Uuid,
        name: &str,
        record_type: &str,
        rdata: serde_json::Value,
        ttl: i32,
        is_static: bool,
    ) -> Result<AdDnsRecord> {
        let timestamp: Option<DateTime<Utc>> = if is_static { None } else { Some(Utc::now()) };

        let record = sqlx::query_as::<_, AdDnsRecord>(
            r#"
            INSERT INTO ad_dns_records (zone_id, name, record_type, rdata, ttl, is_static, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            "#,
        )
        .bind(zone_id)
        .bind(name)
        .bind(record_type)
        .bind(rdata)
        .bind(ttl)
        .bind(is_static)
        .bind(timestamp)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(record)
    }

    /// Query DNS records within a zone, optionally filtered by record type.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn query_records(
        pool: &PgPool,
        zone_id: Uuid,
        name: &str,
        record_type: Option<&str>,
    ) -> Result<Vec<AdDnsRecord>> {
        let records = match record_type {
            Some(rt) => sqlx::query_as::<_, AdDnsRecord>(
                r#"
                    SELECT * FROM ad_dns_records
                    WHERE zone_id = $1 AND name = $2 AND record_type = $3
                    "#,
            )
            .bind(zone_id)
            .bind(name)
            .bind(rt)
            .fetch_all(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?,
            None => sqlx::query_as::<_, AdDnsRecord>(
                "SELECT * FROM ad_dns_records WHERE zone_id = $1 AND name = $2",
            )
            .bind(zone_id)
            .bind(name)
            .fetch_all(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?,
        };

        Ok(records)
    }

    /// Delete stale dynamic records older than `older_than`.
    ///
    /// Only records with a non-NULL `timestamp` (dynamic records) are eligible.
    /// Returns the number of rows deleted.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the DELETE fails.
    pub async fn scavenge(pool: &PgPool, zone_id: Uuid, older_than: DateTime<Utc>) -> Result<u64> {
        let result = sqlx::query(
            r#"
            DELETE FROM ad_dns_records
            WHERE zone_id = $1 AND timestamp IS NOT NULL AND timestamp < $2
            "#,
        )
        .bind(zone_id)
        .bind(older_than)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(result.rows_affected())
    }
}
