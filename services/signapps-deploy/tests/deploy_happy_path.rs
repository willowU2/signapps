//! E2E test: persistence state transitions on a successful deploy.

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
async fn deploy_record_created_and_transitions_to_success() {
    let pool = test_pool().await;
    let version = "v0.0.0-test-happy";
    cleanup(&pool, version).await;

    let dep = signapps_deploy::persistence::insert_pending(&pool, "dev", version, "abc123")
        .await
        .expect("insert pending");
    assert_eq!(dep.env, "dev");
    assert_eq!(dep.version, version);

    signapps_deploy::persistence::mark_running(&pool, dep.id)
        .await
        .expect("mark running");

    signapps_deploy::persistence::mark_success(&pool, dep.id, &["305".to_string()])
        .await
        .expect("mark success");

    let (status, migrations): (String, Vec<String>) =
        sqlx::query_as("SELECT status, migrations_applied FROM deployments WHERE id = $1")
            .bind(dep.id)
            .fetch_one(&pool)
            .await
            .expect("select");
    assert_eq!(status, "success");
    assert_eq!(migrations, vec!["305".to_string()]);

    cleanup(&pool, version).await;
}
