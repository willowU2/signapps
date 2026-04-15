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
    let prefix = "v0.0.0-test-rb";
    cleanup(&pool, prefix).await;

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

    // 2. A new deployment that fails
    let dep = signapps_deploy::persistence::insert_pending(
        &pool,
        "dev",
        &format!("{prefix}-curr"),
        "bbb",
    )
    .await
    .expect("insert curr");
    assert_eq!(
        dep.previous_version.as_deref(),
        Some(format!("{prefix}-prev").as_str())
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

    cleanup(&pool, prefix).await;
}
