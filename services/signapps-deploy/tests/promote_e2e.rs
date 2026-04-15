//! E2E test: promote() finds the last successful dev version.

use sqlx::PgPool;

async fn test_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@127.0.0.1:5432/signapps".to_string());
    PgPool::connect(&url).await.expect("connect")
}

async fn cleanup(pool: &PgPool) {
    let _ = sqlx::query("DELETE FROM deployments WHERE version LIKE 'v0.0.0-promote-%'")
        .execute(pool)
        .await;
}

#[tokio::test]
#[ignore = "requires Postgres"]
async fn last_successful_dev_is_visible_to_promote_logic() {
    let pool = test_pool().await;
    cleanup(&pool).await;

    let dep = signapps_deploy::persistence::insert_pending(
        &pool, "dev", "v0.0.0-promote-candidate", "sha1",
    )
    .await
    .expect("insert");
    signapps_deploy::persistence::mark_running(&pool, dep.id).await.expect("running");
    signapps_deploy::persistence::mark_success(&pool, dep.id, &[]).await.expect("success");

    let got = signapps_deploy::persistence::last_successful(&pool, "dev")
        .await
        .expect("query")
        .expect("some");
    assert_eq!(got.0, "v0.0.0-promote-candidate");

    cleanup(&pool).await;
}
