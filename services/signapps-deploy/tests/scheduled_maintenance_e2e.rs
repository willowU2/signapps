//! E2E test: scheduled → active → completed lifecycle via direct persistence.

use chrono::Utc;
use signapps_cache::CacheService;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

async fn test_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@127.0.0.1:5432/signapps".to_string());
    PgPool::connect(&url).await.expect("connect")
}

async fn cleanup(pool: &PgPool, id: Uuid) {
    let _ = sqlx::query("DELETE FROM scheduled_maintenance WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await;
}

#[tokio::test]
#[ignore = "requires Postgres"]
async fn window_transitions_scheduled_active_completed() {
    let pool = test_pool().await;
    let id = Uuid::new_v4();
    let env = "dev";

    // Insert a window that's due right now
    let now = Utc::now();
    sqlx::query(
        "INSERT INTO scheduled_maintenance (id, env, scheduled_at, duration_minutes, message, status) \
         VALUES ($1, $2, $3, 1, 'test', 'scheduled')",
    )
    .bind(id)
    .bind(env)
    .bind(now)
    .execute(&pool)
    .await
    .expect("insert");

    // Verify it's 'scheduled'
    let (status,): (String,) =
        sqlx::query_as("SELECT status FROM scheduled_maintenance WHERE id = $1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .expect("fetch initial");
    assert_eq!(status, "scheduled");

    // Simulate what scheduler::start_window does
    let cache = Arc::new(CacheService::default_config());
    signapps_deploy::maintenance::enable(&cache, env)
        .await
        .expect("enable");
    sqlx::query(
        "UPDATE scheduled_maintenance SET status = 'active', started_at = now() WHERE id = $1",
    )
    .bind(id)
    .execute(&pool)
    .await
    .expect("mark active");

    assert!(signapps_deploy::maintenance::is_enabled(&cache, env).await);

    let (status_active,): (String,) =
        sqlx::query_as("SELECT status FROM scheduled_maintenance WHERE id = $1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .expect("fetch active");
    assert_eq!(status_active, "active");

    // Simulate end_window
    signapps_deploy::maintenance::disable(&cache, env)
        .await
        .expect("disable");
    sqlx::query(
        "UPDATE scheduled_maintenance SET status = 'completed', completed_at = now() WHERE id = $1",
    )
    .bind(id)
    .execute(&pool)
    .await
    .expect("mark completed");

    assert!(!signapps_deploy::maintenance::is_enabled(&cache, env).await);

    let (final_status,): (String,) =
        sqlx::query_as("SELECT status FROM scheduled_maintenance WHERE id = $1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .expect("fetch final");
    assert_eq!(final_status, "completed");

    cleanup(&pool, id).await;
}
