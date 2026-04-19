//! Integration tests for migration 501 (SO2 governance).
//!
//! Vérifie que les 3 tables (org_raci, org_board_decisions, org_board_votes)
//! + 3 triggers d'audit + la contrainte "1 accountable par projet" sont
//! bien en place.
//!
//! Requires a running PostgreSQL with every migration in `migrations/`
//! already applied. Backend boot runs `sqlx::migrate!()` qui les
//! applique automatiquement.
//!
//! Run with: `cargo test -p signapps-db --test test_migration_501 -- --ignored --nocapture`

#![allow(missing_docs)]

use signapps_db::create_pool;
use sqlx::PgPool;

/// Build a sqlx pool against the `DATABASE_URL` env var with the same
/// fallback the rest of the codebase uses for local dev.
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
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = $1)",
    )
    .bind(name)
    .fetch_one(pool)
    .await
    .expect("query trigger_exists")
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_501_creates_raci_table() {
    let pool = pool().await;
    assert!(
        table_exists(&pool, "org_raci").await,
        "org_raci must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_501_creates_board_decisions_table() {
    let pool = pool().await;
    assert!(
        table_exists(&pool, "org_board_decisions").await,
        "org_board_decisions must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_501_creates_board_votes_table() {
    let pool = pool().await;
    assert!(
        table_exists(&pool, "org_board_votes").await,
        "org_board_votes must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_501_installs_three_audit_triggers() {
    let pool = pool().await;
    let triggers = [
        "org_raci_audit",
        "org_board_decisions_audit",
        "org_board_votes_audit",
    ];
    for name in triggers {
        assert!(
            trigger_exists(&pool, name).await,
            "trigger {name} must be installed"
        );
    }
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_501_unique_accountable_per_project() {
    // Verify that the partial unique index exists: one accountable per project.
    let pool = pool().await;
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes
                        WHERE schemaname = 'public'
                          AND indexname = 'idx_raci_one_accountable')",
    )
    .fetch_one(&pool)
    .await
    .expect("query pg_indexes");
    assert!(
        exists,
        "partial unique index idx_raci_one_accountable must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_501_raci_role_check_constraint() {
    let pool = pool().await;
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*)::bigint FROM pg_constraint
         WHERE conrelid = 'org_raci'::regclass
           AND contype = 'c'",
    )
    .fetch_one(&pool)
    .await
    .expect("query check constraints");
    assert!(
        count >= 1,
        "org_raci must have a CHECK constraint on role, got {count}"
    );
}
