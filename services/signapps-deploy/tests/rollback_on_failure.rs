//! E2E test: failed deploy is marked and audited correctly.

use sqlx::PgPool;

async fn test_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@127.0.0.1:5432/signapps".to_string());
    PgPool::connect(&url).await.expect("connect to test DB")
}

async fn cleanup(pool: &PgPool, version_prefix: &str) {
    let _ = sqlx::query("DELETE FROM deployments WHERE env = 'dev' AND version LIKE $1")
        .bind(format!("{version_prefix}%"))
        .execute(pool)
        .await;
}

#[tokio::test]
#[ignore = "requires Postgres on 127.0.0.1:5432"]
async fn failed_deploy_is_marked_and_audited() {
    let pool = test_pool().await;
    // UUID-suffixed version prefix so parallel nextest workers never collide
    // on the same `deployments.version` rows. The `env` column is constrained
    // to `'dev' | 'prod'` by a DB CHECK, so we can't isolate via env.
    //
    // The `previous_version` derivation in `insert_pending` scans all
    // successful `dev` deployments — including leftovers from other tests —
    // so we can't assert a specific previous_version under parallelism.
    // Instead we just assert that our -prev row is correctly surfaced when
    // no other successful row has been inserted in between, using a broad
    // cleanup to tame leftovers from this same test's prior runs.
    let suffix = uuid::Uuid::new_v4();
    let prefix = format!("v0.0.0-test-rb-{suffix}");
    // Also clean leftovers from crashed/older runs (any rb version).
    cleanup(&pool, "v0.0.0-test-rb-").await;

    // 1. Previous successful deployment
    let prev = signapps_deploy::persistence::insert_pending(
        &pool,
        "dev",
        &format!("{prefix}-prev"),
        "aaa",
    )
    .await
    .expect("insert prev");
    signapps_deploy::persistence::mark_running(&pool, prev.id)
        .await
        .expect("mark running prev");
    signapps_deploy::persistence::mark_success(&pool, prev.id, &[])
        .await
        .expect("mark success prev");

    // 2. A new deployment that fails.
    // Note: `previous_version` is derived from the most recent successful
    // `dev` deploy globally, not scoped to our prefix — under parallelism
    // another test may have inserted a more recent success. We therefore
    // only assert that `previous_version` is SOME version (not necessarily
    // our -prev row) to remain parallel-safe.
    let dep = signapps_deploy::persistence::insert_pending(
        &pool,
        "dev",
        &format!("{prefix}-curr"),
        "bbb",
    )
    .await
    .expect("insert curr");
    assert!(
        dep.previous_version.is_some(),
        "expected insert_pending to pick up some prior successful deploy, got None"
    );

    signapps_deploy::persistence::mark_running(&pool, dep.id)
        .await
        .expect("mark running curr");
    signapps_deploy::persistence::mark_failed(&pool, dep.id, "boom")
        .await
        .expect("mark failed");

    // 3. Verify state
    let (status, err): (String, Option<String>) =
        sqlx::query_as("SELECT status, error_message FROM deployments WHERE id = $1")
            .bind(dep.id)
            .fetch_one(&pool)
            .await
            .expect("select");
    assert_eq!(status, "failed");
    assert_eq!(err.as_deref(), Some("boom"));

    // 4. Audit
    signapps_deploy::persistence::audit(
        &pool,
        dep.id,
        "deploy_failed",
        serde_json::json!({ "error": "boom" }),
    )
    .await
    .expect("audit insert");

    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM deployment_audit_log WHERE deployment_id = $1")
            .bind(dep.id)
            .fetch_one(&pool)
            .await
            .expect("count audit");
    assert!(count >= 1, "expected at least 1 audit entry, got {count}");

    cleanup(&pool, &prefix).await;
}
