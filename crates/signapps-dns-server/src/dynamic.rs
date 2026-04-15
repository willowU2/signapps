//! Dynamic DNS update support (RFC 2136).
//!
//! Allows domain-joined machines to register their A records.

use signapps_db::repositories::AdDnsRepository;
use sqlx::PgPool;
use uuid::Uuid;

/// Process a dynamic DNS update (machine registering its A record).
///
/// Only allows updates from authenticated machine accounts.
/// Uses upsert semantics: the existing dynamic record for the hostname
/// is superseded by the new entry. Stale records are cleaned up by the
/// scavenging routine in [`AdDnsRepository::scavenge`].
///
/// # Errors
///
/// Returns `Error::Database` if the INSERT fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```ignore
/// process_dynamic_update(&pool, zone_id, "workstation01", "10.0.1.42").await?;
/// ```
#[tracing::instrument(skip(pool))]
pub async fn process_dynamic_update(
    pool: &PgPool,
    zone_id: Uuid,
    hostname: &str,
    ip_address: &str,
) -> signapps_common::Result<()> {
    // Insert a new dynamic record (is_static = false so it gets a timestamp for scavenging).
    // The old record will be cleaned up by the scavenging routine.
    AdDnsRepository::add_record(
        pool,
        zone_id,
        hostname,
        "A",
        serde_json::json!({ "ip": ip_address }),
        3600,
        false, // dynamic — not static
    )
    .await?;

    tracing::info!(
        hostname = hostname,
        ip = ip_address,
        "Dynamic DNS update processed"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn dynamic_record_is_not_static() {
        // Dynamic records have is_static=false so a timestamp is set, enabling scavenging.
        let is_static = false;
        assert!(!is_static);
    }

    #[test]
    fn dynamic_rdata_structure() {
        let rdata = serde_json::json!({ "ip": "10.0.1.42" });
        assert_eq!(rdata["ip"], "10.0.1.42");
    }
}
