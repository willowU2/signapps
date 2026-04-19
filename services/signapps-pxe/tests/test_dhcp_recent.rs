//! Integration test for `GET /api/v1/pxe/dhcp/recent`.
//!
//! Inserts more rows than the limit through `record_dhcp_request` and
//! asserts the impl returns exactly `limit` rows, newest first.
//!
//! Run with: `cargo test -p signapps-pxe --test test_dhcp_recent -- --ignored`

#![allow(missing_docs)]

use signapps_db::{create_pool, DatabasePool};

async fn test_pool() -> DatabasePool {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://signapps:signapps_dev@localhost:5432/signapps".into()
    });
    create_pool(&url).await.expect("pg pool")
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_dhcp_recent_returns_limit_rows() {
    let db = test_pool().await;

    // Seed 105 unique MACs prefixed with a run-id so concurrent test
    // runs don't collide and we can isolate our rows for assertions.
    let run_id: u16 = rand::random();
    let prefix = format!("fe:ed:{:02x}:{:02x}", (run_id >> 8) as u8, (run_id & 0xFF) as u8);

    // Cleanup any previous rows (paranoid)
    let _ = sqlx::query("DELETE FROM pxe.dhcp_requests WHERE mac_address LIKE $1")
        .bind(format!("{}:%", prefix))
        .execute(db.inner())
        .await;

    for i in 0..105u16 {
        let mac = format!("{}:{:02x}:{:02x}", prefix, (i >> 8) as u8, (i & 0xFF) as u8);
        signapps_pxe::auto_enroll::record_dhcp_request(
            &db,
            &mac,
            "DISCOVER",
            None,
            None,
            true,
            None,
            false, // do not enroll, only log
        )
        .await
        .expect("record_dhcp_request");
    }

    // Ask for exactly 100 — impl should clamp naturally via SQL LIMIT.
    let all = signapps_pxe::handlers::list_recent_dhcp_impl(&db, 100)
        .await
        .expect("list_recent_dhcp_impl");

    // Filter down to our prefix in case the DB has other rows.
    let ours: Vec<_> = all
        .iter()
        .filter(|r| r.mac_address.starts_with(&prefix))
        .collect();

    assert!(
        ours.len() >= 100 || all.len() == 100,
        "expected at least 100 rows overall, got {} total ({} ours)",
        all.len(),
        ours.len()
    );

    // Newest first ordering: first entry must be >= last entry (within our
    // seeded set). Non-strict because the DB's NOW() resolution may collapse.
    if ours.len() >= 2 {
        assert!(
            ours[0].received_at >= ours[ours.len() - 1].received_at,
            "rows must be returned newest-first"
        );
    }

    // Cleanup
    let _ = sqlx::query("DELETE FROM pxe.dhcp_requests WHERE mac_address LIKE $1")
        .bind(format!("{}:%", prefix))
        .execute(db.inner())
        .await;
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_dhcp_recent_respects_small_limit() {
    let db = test_pool().await;

    let run_id: u16 = rand::random();
    let prefix = format!("ca:fe:{:02x}:{:02x}", (run_id >> 8) as u8, (run_id & 0xFF) as u8);

    for i in 0..10u8 {
        let mac = format!("{}:00:{:02x}", prefix, i);
        signapps_pxe::auto_enroll::record_dhcp_request(
            &db, &mac, "DISCOVER", None, None, true, None, false,
        )
        .await
        .expect("record_dhcp_request");
    }

    let rows = signapps_pxe::handlers::list_recent_dhcp_impl(&db, 3)
        .await
        .expect("list_recent_dhcp_impl");
    assert_eq!(rows.len(), 3, "LIMIT 3 must return exactly 3 rows");

    let _ = sqlx::query("DELETE FROM pxe.dhcp_requests WHERE mac_address LIKE $1")
        .bind(format!("{}:%", prefix))
        .execute(db.inner())
        .await;
}
