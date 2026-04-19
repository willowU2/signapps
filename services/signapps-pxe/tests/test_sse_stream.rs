//! Integration test for the SSE deployment stream.
//!
//! Subscribes to `pxe_deployment_progress` via [`signapps_pxe::sse::subscribe_deployment`],
//! then updates `pxe.deployments.progress` three times and asserts the
//! stream yields matching events (filtered by MAC).
//!
//! Run with: `cargo test -p signapps-pxe --test test_sse_stream -- --ignored`

#![allow(missing_docs)]

use futures_util::StreamExt;
use signapps_db::{create_pool, DatabasePool};

async fn test_pool() -> DatabasePool {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://signapps:signapps_dev@localhost:5432/signapps".into()
    });
    create_pool(&url).await.expect("pg pool")
}

fn unique_mac(suffix: u8) -> String {
    let r: u64 = rand::random();
    format!(
        "be:ef:{:02x}:{:02x}:{:02x}:{:02x}",
        ((r >> 24) & 0xFF) as u8,
        ((r >> 16) & 0xFF) as u8,
        ((r >> 8) & 0xFF) as u8,
        suffix,
    )
}

async fn cleanup(pool: &DatabasePool, mac: &str) {
    let _ = sqlx::query("DELETE FROM pxe.deployments WHERE asset_mac = $1")
        .bind(mac)
        .execute(pool.inner())
        .await;
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_sse_stream_emits_progress_updates() {
    let db = test_pool().await;
    let mac = unique_mac(0xA1);
    cleanup(&db, &mac).await;

    // Seed a deployment row in 'running' with progress 0.
    sqlx::query(
        "INSERT INTO pxe.deployments (asset_mac, status, progress) \
         VALUES ($1, 'running', 0)",
    )
    .bind(&mac)
    .execute(db.inner())
    .await
    .expect("insert deployment");

    // Start the stream in a background task so it is already listening
    // when we issue the UPDATEs.
    let stream_mac = mac.clone();
    let stream_db = db.clone();
    let stream_task = tokio::spawn(async move {
        let rx = signapps_pxe::sse::subscribe_deployment(&stream_db, &stream_mac)
            .await
            .expect("subscribe_deployment");
        let mut rx = Box::pin(rx);
        let mut events: Vec<String> = Vec::new();
        while let Some(evt) = tokio::time::timeout(
            std::time::Duration::from_secs(3),
            rx.next(),
        )
        .await
        .ok()
        .flatten()
        {
            events.push(evt);
            if events.len() >= 3 {
                break;
            }
        }
        events
    });

    // Give the PgListener a moment to register before we trigger NOTIFY.
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;

    for p in [25_i32, 50, 75] {
        sqlx::query("UPDATE pxe.deployments SET progress = $1 WHERE asset_mac = $2")
            .bind(p)
            .bind(&mac)
            .execute(db.inner())
            .await
            .expect("update progress");
        tokio::time::sleep(std::time::Duration::from_millis(80)).await;
    }

    let events = stream_task.await.expect("stream task join");
    assert_eq!(events.len(), 3, "expected exactly 3 events, got: {:?}", events);
    assert!(
        events.iter().any(|e| e.contains("25")),
        "missing progress=25 event: {:?}",
        events,
    );
    assert!(
        events.iter().any(|e| e.contains("50")),
        "missing progress=50 event: {:?}",
        events,
    );
    assert!(
        events.iter().any(|e| e.contains("75")),
        "missing progress=75 event: {:?}",
        events,
    );
    for e in &events {
        assert!(
            e.contains(&mac),
            "event payload missing MAC filter: {:?}",
            e,
        );
    }

    cleanup(&db, &mac).await;
}
