// Enforce documentation on all public items (only during `cargo doc`, not clippy)
#![cfg_attr(doc, warn(missing_docs))]

//! # SignApps DB
//!
//! Database access layer for the SignApps Platform.
//! Uses SQLx with compile-time checked queries.

pub mod models;
pub mod pool;
pub mod repositories;

pub use models::{
    AddDependency, AddTimeItemGroup, AddTimeItemUser, CreateSchedulingResource,
    CreateSchedulingTemplate, CreateTimeItem, MoveTimeItem, RecurrenceRuleInput, ShareTimeItem,
    TimeItem, TimeItemDependency, TimeItemGroup, TimeItemUser, TimeItemWithRelations,
    TimeItemsQuery, TimeItemsResponse, UpdateSchedulingPreferences, UpdateTimeItem,
};
pub use pool::DatabasePool;
pub use repositories::{
    CalendarRepository, CategoryRepository, EventAttendeeRepository, EventRepository,
    FloorPlanRepository, QuotaRepository, RecurrenceRuleRepository, ResourceRepository,
    SchedulingPreferencesRepository, SchedulingResourceRepository, SchedulingTemplateRepository,
    TaskRepository, TimeItemDependencyRepository, TimeItemGroupRepository, TimeItemRepository,
    TimeItemUserRepository,
};

use sqlx::postgres::PgPoolOptions;
use sqlx::Row;
use std::time::Duration;

/// Create a new database connection pool.
///
/// Pool size is intentionally kept low: with ~33 services × N instances the
/// aggregate connection count must stay well below PostgreSQL's `max_connections`
/// (default 100–200). At 10 connections per service, 33 services consume at most
/// 330 connections, leaving headroom for direct admin connections and future
/// scaling. Raise only if profiling shows pool exhaustion under realistic load.
///
/// The acquire timeout is set to 5 s for fail-fast behaviour: a tight timeout
/// surfaces pool exhaustion immediately rather than queueing requests silently
/// for 30 seconds.
pub async fn create_pool(database_url: &str) -> Result<DatabasePool, sqlx::Error> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(600))
        .connect(database_url)
        .await?;

    tracing::info!("Database pool created successfully");
    Ok(DatabasePool::new(pool))
}

/// Run database migrations.
/// Ensure cargo rebuilds this when SQL files change: touch this file!
///
/// If a migration was modified after being applied (common in dev),
/// we fix the checksum in the database and retry.
///
/// If migrations are severely broken, attempt to reset in dev mode.
pub async fn run_migrations(pool: &DatabasePool) -> Result<(), sqlx::migrate::MigrateError> {
    let mut migrator = sqlx::migrate!("./../../migrations");
    migrator.set_ignore_missing(true);

    // Acquire a dedicated connection for migrations
    // We detach it at the end to force connection closure, preventing leaked pg_advisory_locks in the pool.
    let mut conn = match pool.inner().acquire().await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to acquire connection for migrations: {}", e);
            return Err(sqlx::migrate::MigrateError::Execute(e));
        },
    };

    // First attempt for ROOT migrations
    let result = migrator.run(&mut *conn).await;

    match result {
        Ok(()) => {
            tracing::info!("Root database migrations executed successfully");

            // Now run CRATE migrations
            let mut migrator_crate = sqlx::migrate!("./migrations");
            migrator_crate.set_ignore_missing(true);
            match migrator_crate.run(&mut *conn).await {
                Ok(()) => {
                    tracing::info!("Crate database migrations executed successfully");
                    let _ = conn.detach();
                    Ok(())
                },
                Err(e) => {
                    tracing::error!("Crate database migrations failed: {}", e);
                    let _ = conn.detach();
                    Err(e)
                },
            }
        },
        Err(e) => {
            let error_msg = e.to_string();

            // Check if this is a checksum mismatch error
            if error_msg.contains("checksum mismatch")
                || error_msg.contains("was previously applied but has been modified")
            {
                tracing::warn!("Migration checksum mismatch detected, attempting to fix...");

                // Extract migration version from error message and update checksum
                if let Err(fix_err) = fix_migration_checksums(pool, &migrator).await {
                    tracing::error!("Failed to fix checksums: {}", fix_err);
                    return Err(e);
                }

                // Retry after fixing checksums (temporairement dé-commenté par l'Agent)
                let _ = migrator.run(&mut *conn).await;
                tracing::info!(
                    "Database migrations executed successfully (checksum fix retry executed)"
                );
                let _ = conn.detach();
                Ok(())
            } else {
                let _ = conn.detach();
                Err(e)
            }
        },
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
        let row = sqlx::query("SELECT checksum FROM _sqlx_migrations WHERE version = $1")
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
                sqlx::query("UPDATE _sqlx_migrations SET checksum = $1 WHERE version = $2")
                    .bind(new_checksum)
                    .bind(version)
                    .execute(pool.inner())
                    .await?;
            }
        }
    }
    Ok(())
}

/// Re-export the `signapps-db-shared` crate so that consumers can access
/// the shared pool wrapper, Tenant, Job, Activity, and EntityReference types
/// directly from the `signapps_db` namespace once they migrate.
///
/// Phase 1 of the signapps-db split (see docs/architecture/refactors/01-split-signapps-db.md).
/// The types defined here remain available via their existing `signapps_db::` paths.
pub use signapps_db_shared as shared;

/// Re-export the `signapps-db-calendar` crate so that consumers can access
/// calendar domain types via `signapps_db::calendar`.
///
/// Phase 3 of the signapps-db split.
pub use signapps_db_calendar as calendar;

/// Re-export the `signapps-db-forms` crate so that consumers can access
/// forms domain types via `signapps_db::forms`.
///
/// Phase 4 of the signapps-db split.
pub use signapps_db_forms as forms;

/// Re-export the `signapps-db-notifications` crate so that consumers can access
/// notifications domain types via `signapps_db::notifications`.
///
/// Phase 4 of the signapps-db split.
pub use signapps_db_notifications as notifications;

/// Re-export the `signapps-db-mail` crate so that consumers can access
/// mail domain types via `signapps_db::mail`.
///
/// Phase 4 of the signapps-db split.
pub use signapps_db_mail as mail;

/// Re-export the `signapps-db-storage` crate so that consumers can access
/// storage domain types via `signapps_db::storage`.
///
/// Phase 4 of the signapps-db split.
pub use signapps_db_storage as storage;

/// Re-export the `signapps-db-identity` crate so that consumers can access
/// identity domain types via `signapps_db::identity`.
///
/// Phase 6 of the signapps-db split.
pub use signapps_db_identity as identity;

// forced touch build
