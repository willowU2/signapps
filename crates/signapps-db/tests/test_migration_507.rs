//! Integration tests for migration 507 (SO9 multi-assign + ACL + renewals).
//!
//! Vérifie :
//! - Les 3 tables créées (org_resource_assignments, org_acl,
//!   org_resource_renewals).
//! - Les indexes partiels unique owner + unique primary_user.
//! - Le trigger d'audit présent sur chaque table.
//! - Les colonnes nouvelles sur org_resources (photo_url, primary_identifier_type).
//! - La migration des assignments SO8 → SO9 (au moins 1 row par resource
//!   qui avait un `assigned_to_*`).
//!
//! Run with: `cargo test -p signapps-db --test test_migration_507 -- --ignored --nocapture`

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

async fn column_exists(pool: &PgPool, table: &str, col: &str) -> bool {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = $1
                          AND column_name = $2)",
    )
    .bind(table)
    .bind(col)
    .fetch_one(pool)
    .await
    .expect("query column_exists")
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

async fn trigger_exists(pool: &PgPool, name: &str) -> bool {
    sqlx::query_scalar::<_, bool>("SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = $1)")
        .bind(name)
        .fetch_one(pool)
        .await
        .expect("query trigger_exists")
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn migration_507_creates_all_tables() {
    let pool = pool().await;
    assert!(table_exists(&pool, "org_resource_assignments").await);
    assert!(table_exists(&pool, "org_acl").await);
    assert!(table_exists(&pool, "org_resource_renewals").await);
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn migration_507_adds_org_resources_columns() {
    let pool = pool().await;
    assert!(column_exists(&pool, "org_resources", "photo_url").await);
    assert!(column_exists(&pool, "org_resources", "primary_identifier_type").await);
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn migration_507_installs_indexes() {
    let pool = pool().await;
    for name in [
        "idx_ra_resource_active",
        "idx_ra_subject_active",
        "idx_ra_tenant",
        "idx_ra_one_owner",
        "idx_ra_one_primary_user",
        "idx_acl_lookup",
        "idx_acl_subject",
        "idx_acl_role",
        "idx_acl_resource",
        "idx_renewals_due",
        "idx_renewals_resource",
        "idx_renewals_tenant",
    ] {
        assert!(index_exists(&pool, name).await, "index {name} must exist");
    }
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn migration_507_installs_audit_triggers() {
    let pool = pool().await;
    for name in [
        "org_resource_assignments_audit",
        "org_acl_audit",
        "org_resource_renewals_audit",
    ] {
        assert!(trigger_exists(&pool, name).await, "trigger {name} must exist");
    }
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn migration_507_migrates_so8_assignments() {
    let pool = pool().await;
    // Every non-archived resource with a legacy assigned_to_* should
    // now have at least one owner row in org_resource_assignments.
    let legacy_assigned: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM org_resources
          WHERE NOT archived
            AND (assigned_to_person_id IS NOT NULL OR assigned_to_node_id IS NOT NULL)",
    )
    .fetch_one(&pool)
    .await
    .expect("count legacy");
    let migrated: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT resource_id) FROM org_resource_assignments
          WHERE role = 'owner' AND end_at IS NULL",
    )
    .fetch_one(&pool)
    .await
    .expect("count migrated");
    assert!(
        migrated >= legacy_assigned,
        "migrated owner assignments ({migrated}) should cover all legacy ({legacy_assigned})"
    );
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn migration_507_one_owner_per_resource_enforced() {
    let pool = pool().await;
    // Pick an existing resource; try to insert a second 'owner' — must fail.
    let resource_id: Option<uuid::Uuid> = sqlx::query_scalar(
        "SELECT resource_id FROM org_resource_assignments
          WHERE role = 'owner' AND end_at IS NULL LIMIT 1",
    )
    .fetch_optional(&pool)
    .await
    .expect("fetch resource");
    let Some(rid) = resource_id else {
        return; // No owners yet — nothing to test
    };
    // Fetch tenant_id.
    let (tenant_id,): (uuid::Uuid,) =
        sqlx::query_as("SELECT tenant_id FROM org_resources WHERE id = $1")
            .bind(rid)
            .fetch_one(&pool)
            .await
            .expect("fetch tenant");

    let res = sqlx::query(
        "INSERT INTO org_resource_assignments
           (tenant_id, resource_id, subject_type, subject_id, role, is_primary)
         VALUES ($1, $2, 'person', $3, 'owner', TRUE)",
    )
    .bind(tenant_id)
    .bind(rid)
    .bind(uuid::Uuid::new_v4())
    .execute(&pool)
    .await;
    assert!(res.is_err(), "inserting a second owner must violate unique index");
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn migration_507_acl_check_subject_constraint() {
    let pool = pool().await;
    // Cannot insert role subject_type with a subject_id set.
    let res = sqlx::query(
        "INSERT INTO org_acl
           (tenant_id, subject_type, subject_id, action, resource_type, effect)
         VALUES ($1, 'role', $2, 'read', 'resource', 'allow')",
    )
    .bind(uuid::Uuid::new_v4())
    .bind(uuid::Uuid::new_v4())
    .execute(&pool)
    .await;
    assert!(res.is_err(), "role subject_type with subject_id must fail CHECK");
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn migration_507_acl_allows_valid_person_row() {
    let pool = pool().await;
    let tenant: uuid::Uuid = sqlx::query_scalar(
        "SELECT tenant_id FROM org_persons LIMIT 1",
    )
    .fetch_one(&pool)
    .await
    .expect("fetch tenant");
    let person_id: uuid::Uuid = sqlx::query_scalar(
        "SELECT id FROM org_persons WHERE tenant_id = $1 LIMIT 1",
    )
    .bind(tenant)
    .fetch_one(&pool)
    .await
    .expect("fetch person");
    // Clean previous test row to keep the test idempotent.
    sqlx::query(
        "DELETE FROM org_acl WHERE tenant_id = $1 AND subject_type = 'person'
           AND subject_id = $2 AND action = 'read' AND resource_type = '__test__'",
    )
    .bind(tenant)
    .bind(person_id)
    .execute(&pool)
    .await
    .expect("cleanup");
    let res = sqlx::query(
        "INSERT INTO org_acl
           (tenant_id, subject_type, subject_id, action, resource_type, effect)
         VALUES ($1, 'person', $2, 'read', '__test__', 'allow')
         RETURNING id",
    )
    .bind(tenant)
    .bind(person_id)
    .execute(&pool)
    .await;
    assert!(res.is_ok(), "valid person ACL row must insert: {res:?}");
}

#[tokio::test]
#[ignore = "requires postgres with migrations applied"]
async fn migration_507_renewal_kind_check() {
    let pool = pool().await;
    let tenant: Option<uuid::Uuid> = sqlx::query_scalar(
        "SELECT tenant_id FROM org_resources LIMIT 1",
    )
    .fetch_optional(&pool)
    .await
    .expect("fetch tenant");
    let Some(tenant) = tenant else { return; };
    let rid: uuid::Uuid = sqlx::query_scalar(
        "SELECT id FROM org_resources WHERE tenant_id = $1 LIMIT 1",
    )
    .bind(tenant)
    .fetch_one(&pool)
    .await
    .expect("fetch rid");

    let res = sqlx::query(
        "INSERT INTO org_resource_renewals
           (tenant_id, resource_id, kind, due_date)
         VALUES ($1, $2, 'invalid_kind', '2026-12-31')",
    )
    .bind(tenant)
    .bind(rid)
    .execute(&pool)
    .await;
    assert!(res.is_err(), "invalid kind must fail CHECK");
}
