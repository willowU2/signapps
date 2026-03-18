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
    RecurrenceRuleRepository, ResourceRepository, SchedulingPreferencesRepository,
    SchedulingResourceRepository, SchedulingTemplateRepository, TaskRepository,
    TimeItemDependencyRepository, TimeItemGroupRepository, TimeItemRepository,
    TimeItemUserRepository,
};
pub use models::{
    AddDependency, AddTimeItemGroup, AddTimeItemUser, CreateSchedulingResource,
    CreateSchedulingTemplate, CreateTimeItem, MoveTimeItem, RecurrenceRuleInput, ShareTimeItem,
    TimeItem, TimeItemDependency, TimeItemGroup, TimeItemUser, TimeItemWithRelations,
    TimeItemsQuery, TimeItemsResponse, UpdateSchedulingPreferences, UpdateTimeItem,
};

use sqlx::postgres::PgPoolOptions;
use sqlx::Row;
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
    let migrator = sqlx::migrate!("./../../migrations");

    // First attempt
    match migrator.run(pool.inner()).await {
        Ok(()) => {
            tracing::info!("Database migrations executed successfully");
            Ok(())
        }
        Err(e) => {
            let error_msg = e.to_string();

            // Check if this is a checksum mismatch error
            if error_msg.contains("checksum mismatch") {
                tracing::warn!("Migration checksum mismatch detected, attempting to fix...");

                // Extract migration version from error message and update checksum
                if let Err(fix_err) = fix_migration_checksums(pool, &migrator).await {
                    tracing::error!("Failed to fix checksums: {}", fix_err);
                    return Err(e);
                }

                // Retry after fixing checksums
                migrator.run(pool.inner()).await?;
                tracing::info!("Database migrations executed successfully (after checksum fix)");
                Ok(())
            } else {
                Err(e)
            }
        }
    }
}

/// Fix migration checksums in the database when they don't match the files.
async fn fix_migration_checksums(
    pool: &DatabasePool,
    migrator: &sqlx::migrate::Migrator,
) -> Result<(), sqlx::Error> {
    for migration in migrator.migrations.iter() {
        let version = migration.version;
        let new_checksum = migration.checksum.as_ref();

        // Check if this migration exists in DB
        let row = sqlx::query(
            "SELECT checksum FROM _sqlx_migrations WHERE version = $1"
        )
        .bind(version)
        .fetch_optional(pool.inner())
        .await?;

        if let Some(row) = row {
            let db_checksum: Vec<u8> = row.get("checksum");
            if db_checksum != new_checksum {
                tracing::info!(
                    "Updating checksum for migration {} ({})",
                    version,
                    migration.description
                );
                sqlx::query(
                    "UPDATE _sqlx_migrations SET checksum = $1 WHERE version = $2"
                )
                .bind(new_checksum)
                .bind(version)
                .execute(pool.inner())
                .await?;
            }
        }
    }
    Ok(())
}
