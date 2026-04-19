//! Auto-discovery and auto-enrollment of PXE clients via DHCP requests.
//!
//! When the ProxyDHCP listener receives a PXEClient packet, this module
//! records the request in `pxe.dhcp_requests` and (when `auto_enroll` is
//! enabled) upserts the MAC into `pxe.assets` with `status='discovered'`
//! so operators can enroll them from the admin UI.
//!
//! The upsert is **idempotent**: a MAC already known to the database
//! simply has its `last_seen` and optional `dhcp_vendor_class` /
//! `arch_detected` refreshed; no duplicate row is ever created.

use signapps_db::DatabasePool;

/// Record a DHCP request in `pxe.dhcp_requests` and optionally upsert the
/// corresponding asset in `pxe.assets`.
///
/// # Arguments
///
/// * `pool` — pool handle used for the two INSERTs (request log, asset upsert)
/// * `mac` — client MAC in canonical lowercase `xx:xx:xx:xx:xx:xx` form
/// * `msg_type` — `"DISCOVER"` or `"REQUEST"` (truncated to 16 chars by schema)
/// * `vendor_class` — optional DHCP option 60 (e.g. `"PXEClient:Arch:00000:UNDI:002001"`)
/// * `arch` — optional detected architecture label (`"bios"` / `"uefi"` / ...)
/// * `responded` — whether the ProxyDHCP actually emitted an OFFER/ACK
/// * `boot_file` — boot filename advertised in the reply (if any)
/// * `auto_enroll` — when `true`, the MAC is upserted in `pxe.assets`;
///   when `false`, only the request log row is written
///
/// # Errors
///
/// Propagates any `sqlx::Error` from the two queries. The request-log
/// row is always inserted first, so a failure after that point leaves
/// the audit trail intact.
///
/// # Examples
///
/// ```text
/// record_dhcp_request(&pool, "aa:bb:cc:00:00:01", "DISCOVER",
///     Some("PXEClient"), Some("bios"), true, Some("ipxe.kpxe"), true).await?;
/// ```
#[tracing::instrument(skip(pool), fields(mac = %mac))]
pub async fn record_dhcp_request(
    pool: &DatabasePool,
    mac: &str,
    msg_type: &str,
    vendor_class: Option<&str>,
    arch: Option<&str>,
    responded: bool,
    boot_file: Option<&str>,
    auto_enroll: bool,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO pxe.dhcp_requests
             (mac_address, msg_type, vendor_class, arch, responded, response_boot_file)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(mac)
    .bind(msg_type)
    .bind(vendor_class)
    .bind(arch)
    .bind(responded)
    .bind(boot_file)
    .execute(pool.inner())
    .await?;

    if auto_enroll {
        sqlx::query(
            "INSERT INTO pxe.assets
                 (mac_address, status, discovered_via, dhcp_vendor_class,
                  arch_detected, last_seen)
             VALUES ($1, 'discovered', 'dhcp', $2, $3, NOW())
             ON CONFLICT (mac_address) DO UPDATE SET
                 last_seen = NOW(),
                 dhcp_vendor_class =
                     COALESCE(EXCLUDED.dhcp_vendor_class, pxe.assets.dhcp_vendor_class),
                 arch_detected =
                     COALESCE(EXCLUDED.arch_detected, pxe.assets.arch_detected),
                 updated_at = NOW()",
        )
        .bind(mac)
        .bind(vendor_class)
        .bind(arch)
        .execute(pool.inner())
        .await?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    //! Live-DB tests for `record_dhcp_request`. These require a running
    //! PostgreSQL with all workspace migrations already applied. We do
    //! not use `#[sqlx::test]` because its migrator cannot handle the
    //! `$$`-quoted PL/pgSQL in migration 427.
    use super::*;
    use signapps_db::create_pool;

    async fn test_pool() -> DatabasePool {
        let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgres://signapps:signapps_dev@localhost:5432/signapps".into()
        });
        create_pool(&url).await.expect("pg pool")
    }

    /// Unique MAC per test so concurrent runs don't collide.
    fn unique_mac(suffix: u8) -> String {
        let r: u16 = rand::random();
        format!("aa:bb:cc:{:02x}:{:02x}:{:02x}", (r >> 8) as u8, (r & 0xFF) as u8, suffix)
    }

    async fn cleanup(pool: &DatabasePool, mac: &str) {
        let _ = sqlx::query("DELETE FROM pxe.dhcp_requests WHERE mac_address = $1")
            .bind(mac)
            .execute(pool.inner())
            .await;
        let _ = sqlx::query("DELETE FROM pxe.assets WHERE mac_address = $1")
            .bind(mac)
            .execute(pool.inner())
            .await;
    }

    #[tokio::test]
    #[ignore = "requires postgres with migrations applied"]
    async fn test_record_new_mac_creates_asset() {
        let db = test_pool().await;
        let mac = unique_mac(0x01);
        cleanup(&db, &mac).await;

        record_dhcp_request(
            &db,
            &mac,
            "DISCOVER",
            Some("PXEClient:Arch:00000"),
            Some("bios"),
            true,
            Some("signapps-boot.ipxe"),
            true,
        )
        .await
        .expect("record_dhcp_request");

        let status: String = sqlx::query_scalar(
            "SELECT status FROM pxe.assets WHERE mac_address = $1",
        )
        .bind(&mac)
        .fetch_one(db.inner())
        .await
        .expect("select status");
        assert_eq!(status, "discovered");

        let via: String = sqlx::query_scalar(
            "SELECT discovered_via FROM pxe.assets WHERE mac_address = $1",
        )
        .bind(&mac)
        .fetch_one(db.inner())
        .await
        .expect("select discovered_via");
        assert_eq!(via, "dhcp");

        cleanup(&db, &mac).await;
    }

    #[tokio::test]
    #[ignore = "requires postgres with migrations applied"]
    async fn test_record_existing_mac_updates_last_seen() {
        let db = test_pool().await;
        let mac = unique_mac(0x02);
        cleanup(&db, &mac).await;

        record_dhcp_request(&db, &mac, "DISCOVER", None, None, true, None, true)
            .await
            .expect("first insert");
        let first_seen: chrono::DateTime<chrono::Utc> = sqlx::query_scalar(
            "SELECT last_seen FROM pxe.assets WHERE mac_address = $1",
        )
        .bind(&mac)
        .fetch_one(db.inner())
        .await
        .expect("select last_seen");

        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        record_dhcp_request(&db, &mac, "REQUEST", None, None, true, None, true)
            .await
            .expect("second insert");

        let updated_seen: chrono::DateTime<chrono::Utc> = sqlx::query_scalar(
            "SELECT last_seen FROM pxe.assets WHERE mac_address = $1",
        )
        .bind(&mac)
        .fetch_one(db.inner())
        .await
        .expect("select last_seen after");
        assert!(
            updated_seen > first_seen,
            "last_seen must advance: first={:?} updated={:?}",
            first_seen,
            updated_seen
        );

        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM pxe.assets WHERE mac_address = $1",
        )
        .bind(&mac)
        .fetch_one(db.inner())
        .await
        .expect("count");
        assert_eq!(count, 1, "MAC unique, no duplicate asset");

        cleanup(&db, &mac).await;
    }

    #[tokio::test]
    #[ignore = "requires postgres with migrations applied"]
    async fn test_auto_enroll_false_does_not_create_asset() {
        let db = test_pool().await;
        let mac = unique_mac(0x03);
        cleanup(&db, &mac).await;

        record_dhcp_request(&db, &mac, "DISCOVER", None, None, false, None, false)
            .await
            .expect("record_dhcp_request");

        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM pxe.assets WHERE mac_address = $1",
        )
        .bind(&mac)
        .fetch_one(db.inner())
        .await
        .expect("count");
        assert_eq!(count, 0);

        // But the request IS logged
        let req_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM pxe.dhcp_requests WHERE mac_address = $1",
        )
        .bind(&mac)
        .fetch_one(db.inner())
        .await
        .expect("count requests");
        assert_eq!(req_count, 1);

        cleanup(&db, &mac).await;
    }
}
