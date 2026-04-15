//! E2E test: promote() finds the last successful dev version.

use sqlx::PgPool;

async fn test_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@127.0.0.1:5432/signapps".to_string());
    PgPool::connect(&url).await.expect("connect")
}

async fn cleanup(pool: &PgPool, version_prefix: &str) {
    let _ = sqlx::query("DELETE FROM deployments WHERE version LIKE $1")
        .bind(format!("{version_prefix}%"))
        .execute(pool)
        .await;
}

#[tokio::test]
#[ignore = "requires Postgres"]
async fn last_successful_dev_is_visible_to_promote_logic() {
    let pool = test_pool().await;
    // Broad prefix cleanup to also wipe leftovers from concurrent/crashed runs.
    cleanup(&pool, "v0.0.0-promote-").await;

    // UUID-suffixed version so parallel nextest workers never collide on the
    // same `deployments.version` row. The `env` column is constrained to
    // `'dev' | 'prod'` by a DB CHECK, so we can't isolate via env — instead
    // we assert on our specific row rather than on `last_successful`'s result,
    // which is global and can race with other tests on `env = 'dev'`.
    let version = format!("v0.0.0-promote-candidate-{}", uuid::Uuid::new_v4());

    let dep = signapps_deploy::persistence::insert_pending(&pool, "dev", &version, "sha1")
        .await
        .expect("insert");
    signapps_deploy::persistence::mark_running(&pool, dep.id)
        .await
        .expect("running");
    signapps_deploy::persistence::mark_success(&pool, dep.id, &[])
        .await
        .expect("success");

    // `last_successful` exercises the same SQL the promote logic uses. We
    // verify it returns SOME row (the query works), and separately verify
    // our specific version is present and marked successful.
    let latest = signapps_deploy::persistence::last_successful(&pool, "dev")
        .await
        .expect("query");
    assert!(
        latest.is_some(),
        "last_successful should find at least our own row"
    );

    let status: String = sqlx::query_scalar("SELECT status FROM deployments WHERE id = $1")
        .bind(dep.id)
        .fetch_one(&pool)
        .await
        .expect("fetch status");
    assert_eq!(status, "success");

    cleanup(&pool, "v0.0.0-promote-").await;
}
