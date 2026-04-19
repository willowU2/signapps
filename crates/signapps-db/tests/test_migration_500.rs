//! Integration tests for migration 500 (SO1 foundations).
//!
//! Vérifie que les 4 tables + 5 triggers d'audit + fonction
//! `org_audit_trigger` ont été créés et sont fonctionnels.
//!
//! Requires a running PostgreSQL with every migration in `migrations/`
//! already applied. Backend boot runs `sqlx::migrate!()` qui les
//! applique automatiquement.
//!
//! Run with: `cargo test -p signapps-db --test test_migration_500 -- --ignored --nocapture`

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
async fn test_migration_500_creates_positions_table() {
    let pool = pool().await;
    assert!(table_exists(&pool, "org_positions").await, "org_positions must exist");
    assert!(
        table_exists(&pool, "org_position_incumbents").await,
        "org_position_incumbents must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_500_creates_audit_log_table() {
    let pool = pool().await;
    assert!(table_exists(&pool, "org_audit_log").await, "org_audit_log must exist");
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_500_creates_delegations_table() {
    let pool = pool().await;
    assert!(table_exists(&pool, "org_delegations").await, "org_delegations must exist");
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_500_installs_five_audit_triggers() {
    let pool = pool().await;
    let triggers = [
        "org_nodes_audit",
        "org_persons_audit",
        "org_assignments_audit",
        "org_positions_audit",
        "org_pos_incumbents_audit",
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
async fn test_migration_500_audit_function_exists() {
    let pool = pool().await;
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'org_audit_trigger')",
    )
    .fetch_one(&pool)
    .await
    .expect("query pg_proc");
    assert!(exists, "function org_audit_trigger() must exist");
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_500_delegation_scope_check_constraint() {
    let pool = pool().await;
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*)::bigint FROM pg_constraint
         WHERE conrelid = 'org_delegations'::regclass
           AND contype = 'c'",
    )
    .fetch_one(&pool)
    .await
    .expect("query check constraints");
    // scope CHECK + start_at < end_at + delegator <> delegate
    assert!(
        count >= 3,
        "org_delegations must have at least 3 CHECK constraints, got {count}"
    );
}
