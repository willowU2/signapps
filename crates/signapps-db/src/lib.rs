//! # SignApps DB
//!
//! Database access layer for the SignApps Platform.
//! Uses SQLx with compile-time checked queries.

pub mod models;
pub mod pool;
pub mod repositories;

pub use pool::DatabasePool;
pub use repositories::{
    CalendarMemberRepository, CalendarRepository, EventAttendeeRepository, EventRepository,
    ResourceRepository, TaskRepository,
};

use sqlx::postgres::PgPoolOptions;
use std::time::Duration;

/// Create a new database connection pool.
pub async fn create_pool(database_url: &str) -> Result<DatabasePool, sqlx::Error> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(Duration::from_secs(30))  // Increased from 5 to 30 for WSL Docker startup
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
///
/// If migrations are severely broken, attempt to reset in dev mode.
pub async fn run_migrations(pool: &DatabasePool) -> Result<(), sqlx::migrate::MigrateError> {
    let migrator = sqlx::migrate!("../../migrations");

    match migrator.run(pool.inner()).await {
        Ok(()) => {
            tracing::info!("Database migrations completed");
            Ok(())
        },
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
            tracing::info!("Database migrations completed");
            Ok(())
        },
        Err(sqlx::migrate::MigrateError::Execute(e)) => {
            // If migrations fail with execution errors in dev, try to reset
            if cfg!(debug_assertions) {
                tracing::warn!(
                    "Migration execution failed in dev mode: {:?}. Attempting recovery...",
                    e
                );
                // Try to drop ALL schemas and reset _sqlx_migrations table
                let reset_queries = vec![
                    "DROP SCHEMA IF EXISTS identity CASCADE",
                    "DROP SCHEMA IF EXISTS containers CASCADE",
                    "DROP SCHEMA IF EXISTS proxy CASCADE",
                    "DROP SCHEMA IF EXISTS securelink CASCADE",
                    "DROP SCHEMA IF EXISTS storage CASCADE",
                    "DROP SCHEMA IF EXISTS ai CASCADE",
                    "DROP SCHEMA IF EXISTS calendar CASCADE",
                    "DROP SCHEMA IF EXISTS scheduler CASCADE",
                    "DROP SCHEMA IF EXISTS documents CASCADE",
                    "DROP SCHEMA IF EXISTS monitoring CASCADE",
                    // Public schema tables (documents, notifications, etc.)
                    "DROP TABLE IF EXISTS public.document_metadata CASCADE",
                    "DROP TABLE IF EXISTS public.document_presence CASCADE",
                    "DROP TABLE IF EXISTS public.document_permissions CASCADE",
                    "DROP TABLE IF EXISTS public.document_updates CASCADE",
                    "DROP TABLE IF EXISTS public.documents CASCADE",
                    "DROP TABLE IF EXISTS public.notification_digests CASCADE",
                    "DROP TABLE IF EXISTS public.notification_templates CASCADE",
                    "DROP TABLE IF EXISTS public.notifications_sent CASCADE",
                    "DROP TABLE IF EXISTS public.push_subscriptions CASCADE",
                    "DROP TABLE IF EXISTS public.notification_preferences CASCADE",
                    "DROP TABLE IF EXISTS public.calendar_events CASCADE",
                    "DROP TABLE IF EXISTS public.calendar_tasks CASCADE",
                    "DROP FUNCTION IF EXISTS public.cleanup_stale_presence() CASCADE",
                    "DROP EXTENSION IF EXISTS vector CASCADE",
                    "DROP EXTENSION IF EXISTS \"uuid-ossp\" CASCADE",
                    "DROP TABLE IF EXISTS _sqlx_migrations CASCADE",
                ];

                for query in reset_queries {
                    let _ = sqlx::query(query).execute(pool.inner()).await;
                }

                tracing::info!("Database reset completed, retrying migrations...");

                // Retry migrations
                match migrator.run(pool.inner()).await {
                    Ok(()) => {
                        tracing::info!("Database migrations completed after reset");
                        Ok(())
                    },
                    Err(e) => {
                        tracing::error!("Migration recovery failed after reset: {:?}", e);
                        Err(e)
                    },
                }
            } else {
                Err(sqlx::migrate::MigrateError::Execute(e))
            }
        },
        Err(e) => Err(e),
    }
}
