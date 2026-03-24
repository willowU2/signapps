//! Migration Wizard handlers — V2-15.
//!
//! Provides endpoints for managing data migration jobs from external sources
//! (Google Workspace, Microsoft Office 365, or custom sources) into SignApps.
//!
//! All routes require admin role (enforced by the router middleware).
//! State is in-memory; no persistence across restarts.

use axum::{extract::State, http::StatusCode, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use uuid::Uuid;

use crate::AppState;

// =============================================================================
// Domain types
// =============================================================================

/// The origin system from which data is being migrated.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MigrationSource {
    GoogleWorkspace,
    MicrosoftOffice365,
    Custom,
}

/// Lifecycle state of a migration job.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MigrationStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Fine-grained progress counters for a running migration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationProgress {
    /// Total number of items scheduled for migration.
    pub total_items: u32,
    /// Items successfully processed so far.
    pub processed_items: u32,
    /// Items that encountered an error and were skipped.
    pub failed_items: u32,
    /// Human-readable label for the currently executing step.
    pub current_step: String,
}

impl Default for MigrationProgress {
    fn default() -> Self {
        Self {
            total_items: 0,
            processed_items: 0,
            failed_items: 0,
            current_step: "Initializing".to_string(),
        }
    }
}

/// A single migration job record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationJob {
    /// Unique identifier for this job.
    pub id: Uuid,
    /// The system being migrated from.
    pub source: MigrationSource,
    /// Current lifecycle state.
    pub status: MigrationStatus,
    /// Granular progress information.
    pub progress: MigrationProgress,
    /// When the job was created.
    pub started_at: DateTime<Utc>,
    /// When the job finished (Completed, Failed, or Cancelled), if applicable.
    pub completed_at: Option<DateTime<Utc>>,
}

// =============================================================================
// Request types
// =============================================================================

/// Payload for POST /api/v1/admin/migration/start.
#[derive(Debug, Deserialize)]
pub struct StartMigrationRequest {
    /// The source system to migrate from.
    pub source: MigrationSource,
}

// =============================================================================
// In-memory store
// =============================================================================

/// Thread-safe store for the current migration job (at most one at a time).
#[derive(Debug, Clone)]
pub struct MigrationStore {
    inner: std::sync::Arc<tokio::sync::RwLock<Option<MigrationJob>>>,
}

impl Default for MigrationStore {
    fn default() -> Self {
        Self::new()
    }
}

impl MigrationStore {
    pub fn new() -> Self {
        Self {
            inner: std::sync::Arc::new(tokio::sync::RwLock::new(None)),
        }
    }

    /// Return a clone of the current job, if any.
    pub async fn get(&self) -> Option<MigrationJob> {
        self.inner.read().await.clone()
    }

    /// Overwrite the current job record.
    pub async fn set(&self, job: MigrationJob) {
        *self.inner.write().await = Some(job);
    }

    /// Clear the current job record.
    pub async fn clear(&self) {
        *self.inner.write().await = None;
    }
}

// =============================================================================
// Handlers
// =============================================================================

/// POST /api/v1/admin/migration/start
///
/// Creates and starts a new migration job.
/// Returns `409 Conflict` if a job is already running or pending.
#[tracing::instrument(skip(state, payload))]
pub async fn start_migration(
    State(state): State<AppState>,
    Json(payload): Json<StartMigrationRequest>,
) -> Result<(StatusCode, Json<MigrationJob>)> {
    // Prevent starting a second job while one is active.
    if let Some(existing) = state.migration.get().await {
        if matches!(
            existing.status,
            MigrationStatus::Pending | MigrationStatus::Running
        ) {
            return Err(Error::Conflict(
                "A migration job is already running. Cancel it before starting a new one."
                    .to_string(),
            ));
        }
    }

    let job = MigrationJob {
        id: Uuid::new_v4(),
        source: payload.source,
        status: MigrationStatus::Pending,
        progress: MigrationProgress::default(),
        started_at: Utc::now(),
        completed_at: None,
    };

    state.migration.set(job.clone()).await;
    tracing::info!(job_id = %job.id, source = ?job.source, "Migration job started");

    Ok((StatusCode::CREATED, Json(job)))
}

/// GET /api/v1/admin/migration/status
///
/// Returns the current migration job, or `404` if none exists.
#[tracing::instrument(skip(state))]
pub async fn get_migration_status(State(state): State<AppState>) -> Result<Json<MigrationJob>> {
    match state.migration.get().await {
        Some(job) => Ok(Json(job)),
        None => Err(Error::NotFound("No migration job found".to_string())),
    }
}

/// POST /api/v1/admin/migration/cancel
///
/// Cancels the current migration job if it is Pending or Running.
/// Returns `409 Conflict` if the job cannot be cancelled in its current state.
#[tracing::instrument(skip(state))]
pub async fn cancel_migration(State(state): State<AppState>) -> Result<Json<MigrationJob>> {
    let mut job = state
        .migration
        .get()
        .await
        .ok_or_else(|| Error::NotFound("No migration job found".to_string()))?;

    match job.status {
        MigrationStatus::Pending | MigrationStatus::Running => {
            job.status = MigrationStatus::Cancelled;
            job.completed_at = Some(Utc::now());
            state.migration.set(job.clone()).await;
            tracing::info!(job_id = %job.id, "Migration job cancelled by admin");
            Ok(Json(job))
        },
        _ => Err(Error::Conflict(format!(
            "Cannot cancel a migration in '{}' state",
            serde_json::to_string(&job.status).unwrap_or_default()
        ))),
    }
}
