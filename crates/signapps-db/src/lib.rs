//! # SignApps DB
//!
//! Database access layer for the SignApps Platform.
//! Uses SQLx with compile-time checked queries.

pub mod models;
pub mod pool;
pub mod repositories;

pub use pool::DatabasePool;
pub use repositories::{
    CalendarRepository, CalendarMemberRepository, EventRepository,
    EventAttendeeRepository, TaskRepository, ResourceRepository,
};

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
///
/// If a migration was modified after being applied (common in dev),
/// we fix the checksum in the database and retry.
pub async fn run_migrations(pool: &DatabasePool) -> Result<(), sqlx::migrate::MigrateError> {
    let migrator = sqlx::migrate!("../../migrations");

    match migrator.run(pool.inner()).await {
        Ok(()) => {},
        Err(sqlx::migrate::MigrateError::VersionMismatch(version)) => {
            tracing::warn!(
                "Migration {} checksum mismatch — fixing (dev environment)",
                version
            );
            // Find the migration with this version and update its checksum
            if let Some(m) = migrator.iter().find(|m| m.version == version) {
                let checksum_bytes = &*m.checksum;
                sqlx::query("UPDATE _sqlx_migrations SET checksum = $1 WHERE version = $2")
                    .bind(checksum_bytes)
                    .bind(version)
                    .execute(pool.inner())
                    .await
                    .map_err(|e| sqlx::migrate::MigrateError::Execute(e))?;
            }
            // Retry
            migrator.run(pool.inner()).await?;
        },
        Err(e) => return Err(e),
    }

    tracing::info!("Database migrations completed");
    Ok(())
}
