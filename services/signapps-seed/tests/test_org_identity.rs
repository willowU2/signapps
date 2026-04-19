//! Integration test: seeding org + identity + ad against a running DB.
//!
//! Requires a live `DATABASE_URL` pointing at a localhost PostgreSQL.
//! Skipped when `DATABASE_URL` is not set.

use signapps_seed::{run_seed, SeedArgs};

fn db_url() -> Option<String> {
    std::env::var("DATABASE_URL").ok()
}

#[tokio::test]
async fn test_org_identity_ad_creates_expected_rows() {
    let Some(db_url) = db_url() else {
        eprintln!("DATABASE_URL not set — skipping");
        return;
    };

    let args = SeedArgs {
        database_url: db_url.clone(),
        force: false,
        reset: false,
        dry_run: false,
        only: None,
    };

    run_seed(args).await.expect("seed should succeed");

    let pool = sqlx::PgPool::connect(&db_url)
        .await
        .expect("connect to DB");

    // The acme-corp tenant must exist with at least 5 org_nodes + 15 persons
    let tenant_id: (uuid::Uuid,) =
        sqlx::query_as("SELECT id FROM identity.tenants WHERE slug = 'acme-corp'")
            .fetch_one(&pool)
            .await
            .expect("acme-corp tenant");

    let nodes: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM org_nodes WHERE tenant_id = $1")
            .bind(tenant_id.0)
            .fetch_one(&pool)
            .await
            .expect("node count");
    assert!(
        nodes.0 >= 5,
        "expected >= 5 org_nodes (root + 4 OUs), got {}",
        nodes.0
    );

    let persons: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM org_persons WHERE tenant_id = $1")
            .bind(tenant_id.0)
            .fetch_one(&pool)
            .await
            .expect("person count");
    assert!(
        persons.0 >= 15,
        "expected >= 15 org_persons, got {}",
        persons.0
    );

    let users: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM identity.users WHERE email LIKE '%@acme.corp'")
            .fetch_one(&pool)
            .await
            .expect("user count");
    assert!(users.0 >= 15, "expected >= 15 Acme users, got {}", users.0);

    let ad: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM org_ad_config WHERE tenant_id = $1")
            .bind(tenant_id.0)
            .fetch_one(&pool)
            .await
            .expect("ad count");
    assert_eq!(ad.0, 1, "expected exactly 1 ad_config row");
}
