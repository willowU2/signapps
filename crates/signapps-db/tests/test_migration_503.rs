//! Integration tests for migration 503 (SO4 integrations).
//!
//! Vérifie que les 3 tables (org_public_links, org_webhooks,
//! org_webhook_deliveries) + 2 colonnes (org_persons.photo_url,
//! org_nodes.group_photo_url) + 2 triggers d'audit sont bien en place.
//!
//! Run with: `cargo test -p signapps-db --test test_migration_503 -- --ignored --nocapture`

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

async fn column_exists(pool: &PgPool, table: &str, column: &str) -> bool {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = $1
                          AND column_name = $2)",
    )
    .bind(table)
    .bind(column)
    .fetch_one(pool)
    .await
    .expect("query column_exists")
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
async fn test_migration_503_creates_public_links_table() {
    let pool = pool().await;
    assert!(
        table_exists(&pool, "org_public_links").await,
        "org_public_links must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_503_creates_webhooks_table() {
    let pool = pool().await;
    assert!(
        table_exists(&pool, "org_webhooks").await,
        "org_webhooks must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_503_creates_webhook_deliveries_table() {
    let pool = pool().await;
    assert!(
        table_exists(&pool, "org_webhook_deliveries").await,
        "org_webhook_deliveries must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_503_adds_photo_url_to_persons() {
    let pool = pool().await;
    assert!(
        column_exists(&pool, "org_persons", "photo_url").await,
        "org_persons.photo_url must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_503_adds_group_photo_url_to_nodes() {
    let pool = pool().await;
    assert!(
        column_exists(&pool, "org_nodes", "group_photo_url").await,
        "org_nodes.group_photo_url must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_503_installs_audit_triggers() {
    let pool = pool().await;
    let triggers = ["org_public_links_audit", "org_webhooks_audit"];
    for name in triggers {
        assert!(
            trigger_exists(&pool, name).await,
            "trigger {name} must be installed"
        );
    }
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_503_installs_indexes() {
    let pool = pool().await;
    let indexes = [
        "idx_public_links_tenant",
        "idx_public_links_slug_active",
        "idx_webhooks_tenant_active",
        "idx_webhook_deliveries_webhook",
        "idx_webhook_deliveries_event_type",
    ];
    for name in indexes {
        assert!(index_exists(&pool, name).await, "index {name} must exist");
    }
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_503_visibility_check_constraint() {
    let pool = pool().await;
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*)::bigint FROM pg_constraint
         WHERE conrelid = 'org_public_links'::regclass AND contype = 'c'",
    )
    .fetch_one(&pool)
    .await
    .expect("query check constraints");
    assert!(
        count >= 1,
        "org_public_links must have CHECK on visibility, got {count}"
    );
}
