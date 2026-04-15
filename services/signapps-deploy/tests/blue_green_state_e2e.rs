//! E2E test: active_stack swap alternates blue and green.

use signapps_common::active_stack::{get_active, swap, Color};
use sqlx::PgPool;

async fn test_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@127.0.0.1:5432/signapps".to_string());
    PgPool::connect(&url).await.expect("connect")
}

async fn reset_to_blue(pool: &PgPool, env: &str) {
    let _ = sqlx::query("UPDATE active_stack SET active_color = 'blue' WHERE env = $1")
        .bind(env)
        .execute(pool)
        .await;
}

#[tokio::test]
#[ignore = "requires Postgres"]
async fn swap_alternates_blue_and_green() {
    let pool = test_pool().await;
    reset_to_blue(&pool, "dev").await;

    let c1 = get_active(&pool, "dev").await.expect("get initial");
    assert_eq!(c1, Color::Blue);

    let c2 = swap(&pool, "dev", None).await.expect("swap 1");
    assert_eq!(c2, Color::Green);

    let c3 = swap(&pool, "dev", None).await.expect("swap 2");
    assert_eq!(c3, Color::Blue);

    let after = get_active(&pool, "dev").await.expect("get final");
    assert_eq!(after, Color::Blue);

    reset_to_blue(&pool, "dev").await;
}
