// Enforce documentation on all public items (only during `cargo doc`, not clippy)
#![cfg_attr(doc, warn(missing_docs))]

//! # SignApps DB Shared
//!
//! Minimal shared database primitives for the SignApps Platform.
//!
//! Contains the connection pool wrapper and cross-cutting domain models
//! (Tenant, EntityReference, Job, Activity) with their repositories.
//!
//! All other services depend on this crate transitively via `signapps-db`
//! until the domain-specific sub-crates are extracted (Phases 2–4).

pub mod models;
pub mod pool;
pub mod repositories;

pub use models::{
    Activity, CreateEntityReference, CreateJob, EntityReference, Job, JobRun, JobRunStatus,
    JobStats, JobTargetType, UpdateJob,
};
pub use pool::DatabasePool;
pub use repositories::{
    ActivityRepository, EntityReferenceRepository, JobRepository, LabelRepository,
    ProjectRepository, ReservationRepository, ResourceTypeRepository, TemplateRepository,
    TenantCalendarRepository, TenantRepository, TenantResourceRepository, TenantTaskRepository,
    WorkspaceRepository,
};

use sqlx::postgres::PgPoolOptions;
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
