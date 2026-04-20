//! Integration tests for migration 506 (SO8 resources catalog).
//!
//! Vérifie que les 2 tables (`org_resources`, `org_resource_status_log`)
//! + leurs indexes + trigger d'audit sont bien en place.
//!
//! Run with: `cargo test -p signapps-db --test test_migration_506 -- --ignored --nocapture`

#![allow(missing_docs)]

use signapps_db::create_pool;
use sqlx::PgPool;

async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://signapps:signapps_dev@localhost:5432/signapps".into()
    });
    create_pool(&url)
        .await
        .expect("pg pool")
        .inner()
        .clone()
}

async fn table_exists(pool: &PgPool, name: &str) -> bool {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = $1)",
    )
    .bind(name)
    .fetch_one(pool)
    .await
    .expect("query table_exists")
}

async fn trigger_exists(pool: &PgPool, name: &str) -> bool {
    sqlx::query_scalar::<_, bool>("SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = $1)")
        .bind(name)
        .fetch_one(pool)
        .await
        .expect("query trigger_exists")
}

async fn index_exists(pool: &PgPool, name: &str) -> bool {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes
                        WHERE schemaname = 'public' AND indexname = $1)",
    )
    .bind(name)
    .fetch_one(pool)
    .await
    .expect("query pg_indexes")
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_506_creates_resources_table() {
    let pool = pool().await;
    assert!(
        table_exists(&pool, "org_resources").await,
        "org_resources must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_506_creates_status_log_table() {
    let pool = pool().await;
    assert!(
        table_exists(&pool, "org_resource_status_log").await,
        "org_resource_status_log must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_506_installs_audit_trigger() {
    let pool = pool().await;
    assert!(
        trigger_exists(&pool, "org_resources_audit").await,
        "trigger org_resources_audit must be installed"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_506_installs_indexes() {
    let pool = pool().await;
    let indexes = [
        "idx_resources_tenant",
        "idx_resources_kind",
        "idx_resources_person",
        "idx_resources_node",
        "idx_resources_site",
        "idx_resources_status",
        "idx_resources_qr_token",
        "idx_resource_status_log_resource",
    ];
    for name in indexes {
        assert!(index_exists(&pool, name).await, "index {name} must exist");
    }
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_506_kind_check_constraint() {
    let pool = pool().await;
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*)::bigint FROM pg_constraint
         WHERE conrelid = 'org_resources'::regclass AND contype = 'c'",
    )
    .fetch_one(&pool)
    .await
    .expect("query check constraints");
    // Expect at least 3 CHECKs: kind, status, assigned_to_person XOR node.
    assert!(
        count >= 3,
        "org_resources must have CHECK constraints on kind/status/assignment, got {count}"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_506_unique_slug_per_tenant() {
    let pool = pool().await;
    let idx: Option<String> = sqlx::query_scalar(
        "SELECT indexname FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'org_resources'
            AND indexname LIKE '%slug%'",
    )
    .fetch_optional(&pool)
    .await
    .expect("query slug unique index");
    assert!(
        idx.is_some(),
        "a unique index on (tenant_id, slug) must exist"
    );
}
