//! Integration tests for migration 502 (SO3 scale & power).
//!
//! Vérifie que les 4 tables (org_templates, org_headcount_plan, org_skills,
//! org_person_skills) + 3 triggers d'audit + 2 GIN FTS indexes + les
//! contraintes CHECK (level 1-5, category enum, head_count >= 0) sont
//! bien en place.
//!
//! Run with: `cargo test -p signapps-db --test test_migration_502 -- --ignored --nocapture`

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
async fn test_migration_502_creates_templates_table() {
    let pool = pool().await;
    assert!(
        table_exists(&pool, "org_templates").await,
        "org_templates must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_502_creates_headcount_plan_table() {
    let pool = pool().await;
    assert!(
        table_exists(&pool, "org_headcount_plan").await,
        "org_headcount_plan must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_502_creates_skills_table() {
    let pool = pool().await;
    assert!(
        table_exists(&pool, "org_skills").await,
        "org_skills must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_502_creates_person_skills_table() {
    let pool = pool().await;
    assert!(
        table_exists(&pool, "org_person_skills").await,
        "org_person_skills must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_502_installs_three_audit_triggers() {
    let pool = pool().await;
    let triggers = [
        "org_templates_audit",
        "org_headcount_plan_audit",
        "org_skills_audit",
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
async fn test_migration_502_installs_two_fts_indexes() {
    let pool = pool().await;
    assert!(
        index_exists(&pool, "idx_persons_fts").await,
        "idx_persons_fts (GIN tsvector) must exist"
    );
    assert!(
        index_exists(&pool, "idx_nodes_fts").await,
        "idx_nodes_fts (GIN tsvector) must exist"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_502_skill_category_check_constraint() {
    let pool = pool().await;
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*)::bigint FROM pg_constraint
         WHERE conrelid = 'org_skills'::regclass AND contype = 'c'",
    )
    .fetch_one(&pool)
    .await
    .expect("query check constraints");
    assert!(
        count >= 1,
        "org_skills must have a CHECK constraint on category, got {count}"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_502_person_skills_level_check_constraint() {
    let pool = pool().await;
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*)::bigint FROM pg_constraint
         WHERE conrelid = 'org_person_skills'::regclass AND contype = 'c'",
    )
    .fetch_one(&pool)
    .await
    .expect("query check constraints");
    assert!(
        count >= 1,
        "org_person_skills must have a CHECK constraint on level, got {count}"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn test_migration_502_headcount_plan_head_count_check() {
    let pool = pool().await;
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*)::bigint FROM pg_constraint
         WHERE conrelid = 'org_headcount_plan'::regclass AND contype = 'c'",
    )
    .fetch_one(&pool)
    .await
    .expect("query check constraints");
    assert!(
        count >= 1,
        "org_headcount_plan must have CHECK on target_head_count, got {count}"
    );
}
