//! Integration tests for migration 427 (PXE auto-discovery + SSE trigger).
//!
//! Requires a running PostgreSQL with every migration in `migrations/`
//! already applied (e.g. via `just db-migrate`). The tests simply
//! assert that the expected schema objects exist.
//!
//! Note: we do NOT use `#[sqlx::test]` because its naïve `;`-splitting
//! migrator cannot handle `$$`-quoted PL/pgSQL bodies (like the
//! `pxe_deployment_notify()` function).
//!
//! Run with: `cargo test -p signapps-db --test test_migration_427 -- --ignored --nocapture`

#![allow(missing_docs)]

use signapps_db::create_pool;
use sqlx::PgPool;

/// Build a sqlx pool against the `DATABASE_URL` env var with the same
/// fallback the rest of the codebase uses for local dev.
async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://signapps:signapps_dev@localhost:5432/signapps".into()
    });
    create_pool(&url).await.expect("pg pool").inner().clone()
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_427_adds_autodiscovery_columns() {
    let pool = pool().await;
    let cols = sqlx::query_scalar::<_, String>(
        "SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'pxe' AND table_name = 'assets'
           AND column_name IN (
               'discovered_via', 'boot_count', 'last_boot_profile_id',
               'dhcp_vendor_class', 'arch_detected'
           )",
    )
    .fetch_all(&pool)
    .await
    .expect("query columns");
    assert_eq!(
        cols.len(),
        5,
        "5 new pxe.assets columns expected, got {}: {:?}",
        cols.len(),
        cols
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_427_creates_dhcp_requests_table() {
    let pool = pool().await;
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'pxe' AND table_name = 'dhcp_requests')",
    )
    .fetch_one(&pool)
    .await
    .expect("query table exists");
    assert!(exists, "pxe.dhcp_requests must exist");
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_427_installs_notify_trigger() {
    let pool = pool().await;
    let trig: Option<String> = sqlx::query_scalar(
        "SELECT tgname FROM pg_trigger WHERE tgname = 'pxe_deployment_progress_notify'",
    )
    .fetch_optional(&pool)
    .await
    .expect("query trigger");
    assert!(
        trig.is_some(),
        "trigger pxe_deployment_progress_notify must be installed"
    );
}
