//! Integration tests for `/api/v1/pxe/assets/discovered` and
//! `/api/v1/pxe/assets/:mac/enroll`.
//!
//! These tests exercise the pure-DB impl functions (no HTTP stack)
//! against a live PostgreSQL with every migration applied.
//!
//! Run with: `cargo test -p signapps-pxe --test test_discovered_endpoints -- --ignored`

#![allow(missing_docs)]

use signapps_db::{create_pool, DatabasePool};
use uuid::Uuid;

async fn test_pool() -> DatabasePool {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://signapps:signapps_dev@localhost:5432/signapps".into()
    });
    create_pool(&url).await.expect("pg pool")
}

fn unique_mac(suffix: u8) -> String {
    let r: u64 = rand::random();
    format!(
        "de:ad:{:02x}:{:02x}:{:02x}:{:02x}",
        ((r >> 24) & 0xFF) as u8,
        ((r >> 16) & 0xFF) as u8,
        ((r >> 8) & 0xFF) as u8,
        suffix
    )
}

async fn cleanup(pool: &DatabasePool, macs: &[&str]) {
    for mac in macs {
        let _ = sqlx::query("DELETE FROM pxe.dhcp_requests WHERE mac_address = $1")
            .bind(mac)
            .execute(pool.inner())
            .await;
        let _ = sqlx::query("DELETE FROM pxe.assets WHERE mac_address = $1")
            .bind(mac)
            .execute(pool.inner())
            .await;
    }
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_list_discovered_assets() {
    let db = test_pool().await;
    let mac1 = unique_mac(0x10);
    let mac2 = unique_mac(0x11);
    cleanup(&db, &[&mac1, &mac2]).await;

    signapps_pxe::auto_enroll::record_dhcp_request(
        &db,
        &mac1,
        "DISCOVER",
        None,
        None,
        true,
        None,
        true,
    )
    .await
    .expect("record 1");
    signapps_pxe::auto_enroll::record_dhcp_request(
        &db,
        &mac2,
        "DISCOVER",
        None,
        None,
        true,
        None,
        true,
    )
    .await
    .expect("record 2");

    let rows = signapps_pxe::handlers::list_discovered_impl(&db)
        .await
        .expect("list_discovered_impl");

    let ours: Vec<_> = rows
        .iter()
        .filter(|a| a.mac_address == mac1 || a.mac_address == mac2)
        .collect();
    assert_eq!(ours.len(), 2, "both our discovered assets should appear");
    assert!(
        ours.iter().all(|a| a.status == "discovered"),
        "all returned rows must have status='discovered'"
    );

    cleanup(&db, &[&mac1, &mac2]).await;
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_enroll_asset_transitions_status() {
    let db = test_pool().await;
    let mac = unique_mac(0x20);
    cleanup(&db, &[&mac]).await;

    signapps_pxe::auto_enroll::record_dhcp_request(
        &db,
        &mac,
        "DISCOVER",
        None,
        None,
        true,
        None,
        true,
    )
    .await
    .expect("record");

    signapps_pxe::handlers::enroll_asset_impl(
        &db,
        &mac,
        Some("workstation-42"),
        Option::<Uuid>::None,
    )
    .await
    .expect("enroll_asset_impl");

    let (status, hostname): (String, Option<String>) = sqlx::query_as(
        "SELECT status, hostname FROM pxe.assets WHERE mac_address = $1",
    )
    .bind(&mac)
    .fetch_one(db.inner())
    .await
    .expect("select");
    assert_eq!(status, "enrolled");
    assert_eq!(hostname.as_deref(), Some("workstation-42"));

    cleanup(&db, &[&mac]).await;
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_enroll_asset_no_op_when_not_discovered() {
    // Pre-existing enrolled asset must not be re-overwritten by a stray
    // enroll call (guard: `WHERE status = 'discovered'`).
    let db = test_pool().await;
    let mac = unique_mac(0x30);
    cleanup(&db, &[&mac]).await;

    // Seed it already enrolled
    sqlx::query(
        "INSERT INTO pxe.assets (mac_address, status, hostname, discovered_via)
         VALUES ($1, 'enrolled', 'original-host', 'manual')",
    )
    .bind(&mac)
    .execute(db.inner())
    .await
    .expect("seed");

    signapps_pxe::handlers::enroll_asset_impl(
        &db,
        &mac,
        Some("should-be-ignored"),
        Option::<Uuid>::None,
    )
    .await
    .expect("enroll_asset_impl");

    let hostname: Option<String> =
        sqlx::query_scalar("SELECT hostname FROM pxe.assets WHERE mac_address = $1")
            .bind(&mac)
            .fetch_one(db.inner())
            .await
            .expect("select");
    assert_eq!(
        hostname.as_deref(),
        Some("original-host"),
        "already-enrolled asset must not be overwritten"
    );

    cleanup(&db, &[&mac]).await;
}
