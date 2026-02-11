//! # SignApps DB
//!
//! Database access layer for the SignApps Platform.
//! Uses SQLx with compile-time checked queries.

pub mod models;
pub mod pool;
pub mod repositories;

pub use pool::DatabasePool;

use sqlx::postgres::PgPoolOptions;
use std::time::Duration;

/// Create a new database connection pool.
pub async fn create_pool(database_url: &str) -> Result<DatabasePool, sqlx::Error> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(600))
        .connect(database_url)
        .await?;

    tracing::info!("Database pool created successfully");
    Ok(DatabasePool::new(pool))
}

/// Run database migrations.
pub async fn run_migrations(pool: &DatabasePool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("../../migrations").run(pool.inner()).await?;

    tracing::info!("Database migrations completed");
    Ok(())
}
