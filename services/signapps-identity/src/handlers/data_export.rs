//! RGPD Data Export handlers — V3-02.
//!
//! Implements the right of data portability (GDPR Art. 20) by allowing users to
//! request, track and download an export of all their personal data.
//!
//! Three endpoints are exposed under the protected (auth-required) router:
//!
//! - `POST /api/v1/users/me/export`          — request a new data export job
//! - `GET  /api/v1/users/me/export/status`   — poll the current job status
//! - `GET  /api/v1/users/me/export/download` — download the exported data (JSON)
//!
//! State is held in-memory (one active job per user); no file system or object
//! storage is involved in this foundation version.

use axum::{extract::State, http::StatusCode, Extension, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use signapps_db::repositories::UserRepository;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::AppState;

// =============================================================================
// Domain types
// =============================================================================

/// Lifecycle state of a data export job.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExportStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

/// A single data export job record (one per user at a time).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataExportJob {
    /// Unique identifier for this export job.
    pub id: Uuid,
    /// The user who requested the export.
    pub user_id: Uuid,
    /// Current lifecycle state.
    pub status: ExportStatus,
    /// When the export was requested.
    pub requested_at: DateTime<Utc>,
    /// When the export completed (or failed), if applicable.
    pub completed_at: Option<DateTime<Utc>>,
    /// URL from which the export can be downloaded once completed.
    /// Points to the authenticated GET /api/v1/users/me/export/download endpoint
    /// which fetches live user data from the database.
    pub download_url: Option<String>,
}

/// The personal data payload returned on download.
#[derive(Debug, Serialize)]
pub struct PersonalDataExport {
    pub export_id: Uuid,
    pub exported_at: DateTime<Utc>,
    pub profile: ProfileData,
}

/// Subset of the user record that is included in the export.
#[derive(Debug, Serialize)]
pub struct ProfileData {
    pub id: Uuid,
    pub username: String,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub created_at: String,
    pub last_login: Option<String>,
    pub auth_provider: String,
    pub mfa_enabled: bool,
}

// =============================================================================
// In-memory store  (one active job per user)
// =============================================================================

/// Thread-safe map from `user_id` to their latest `DataExportJob`.
#[derive(Debug, Clone)]
pub struct DataExportStore {
    inner: Arc<RwLock<HashMap<Uuid, DataExportJob>>>,
}

impl Default for DataExportStore {
    fn default() -> Self {
        Self::new()
    }
}

impl DataExportStore {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Return the latest job for a given user, if any.
#[tracing::instrument(skip_all)]
    pub async fn get(&self, user_id: Uuid) -> Option<DataExportJob> {
        self.inner.read().await.get(&user_id).cloned()
    }

    /// Insert or overwrite the job for a given user.
#[tracing::instrument(skip_all)]
    pub async fn set(&self, job: DataExportJob) {
        self.inner.write().await.insert(job.user_id, job);
    }
}

// =============================================================================
// Handlers
// =============================================================================

/// POST /api/v1/users/me/export
///
/// Requests a new personal data export for the authenticated user.
/// Returns `409 Conflict` if an export job is already pending or processing.
/// Once created the job is immediately processed synchronously (foundation
/// version — no background worker yet) and marked `Completed`.
#[tracing::instrument(skip(state, claims))]
pub async fn request_export(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<(StatusCode, Json<DataExportJob>)> {
    let user_id = claims.sub;

    // Prevent duplicate active jobs.
    if let Some(existing) = state.data_export.get(user_id).await {
        if matches!(
            existing.status,
            ExportStatus::Pending | ExportStatus::Processing
        ) {
            return Err(Error::Conflict(
                "An export job is already in progress for this user.".to_string(),
            ));
        }
    }

    // Create a new job in Pending state.
    let mut job = DataExportJob {
        id: Uuid::new_v4(),
        user_id,
        status: ExportStatus::Pending,
        requested_at: Utc::now(),
        completed_at: None,
        download_url: None,
    };
    state.data_export.set(job.clone()).await;

    // Transition → Processing.
    job.status = ExportStatus::Processing;
    state.data_export.set(job.clone()).await;

    // Verify that the requesting user exists (also used during download).
    let user_exists = UserRepository::find_by_id(&state.pool, user_id)
        .await
        .map(|u| u.is_some())
        .unwrap_or(false);

    if !user_exists {
        job.status = ExportStatus::Failed;
        job.completed_at = Some(Utc::now());
        state.data_export.set(job.clone()).await;
        return Err(Error::NotFound("User not found".to_string()));
    }

    // Mark Completed; download endpoint will fetch live data on demand.
    job.status = ExportStatus::Completed;
    job.completed_at = Some(Utc::now());
    job.download_url = Some("/api/v1/users/me/export/download".to_string());
    state.data_export.set(job.clone()).await;

    tracing::info!(
        user_id = %user_id,
        job_id  = %job.id,
        "RGPD data export job created and completed"
    );

    Ok((StatusCode::CREATED, Json(job)))
}

/// GET /api/v1/users/me/export/status
///
/// Returns the status of the authenticated user's latest export job.
/// Returns `404 Not Found` if no export has ever been requested.
#[tracing::instrument(skip(state, claims))]
pub async fn export_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<DataExportJob>> {
    match state.data_export.get(claims.sub).await {
        Some(job) => Ok(Json(job)),
        None => Err(Error::NotFound(
            "No data export job found for this user.".to_string(),
        )),
    }
}

/// GET /api/v1/users/me/export/download
///
/// Downloads the personal data of the authenticated user as JSON.
/// Returns `404 Not Found` if no completed export exists.
/// Returns `409 Conflict` if the latest job has not yet completed.
#[tracing::instrument(skip(state, claims))]
pub async fn download_export(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<PersonalDataExport>> {
    let user_id = claims.sub;

    // Validate that a completed job exists.
    let job =
        state.data_export.get(user_id).await.ok_or_else(|| {
            Error::NotFound("No data export job found for this user.".to_string())
        })?;

    match job.status {
        ExportStatus::Completed => {},
        ExportStatus::Pending | ExportStatus::Processing => {
            return Err(Error::Conflict(
                "Export is not yet ready. Please check status and retry.".to_string(),
            ));
        },
        ExportStatus::Failed => {
            return Err(Error::Internal(
                "The export job failed. Please request a new export.".to_string(),
            ));
        },
    }

    // Fetch the live user record for the export payload.
    let user = UserRepository::find_by_id(&state.pool, user_id)
        .await?
        .ok_or_else(|| Error::NotFound("User not found".to_string()))?;

    let payload = PersonalDataExport {
        export_id: job.id,
        exported_at: Utc::now(),
        profile: ProfileData {
            id: user.id,
            username: user.username,
            email: user.email,
            display_name: user.display_name,
            created_at: user.created_at.to_rfc3339(),
            last_login: user.last_login.map(|dt| dt.to_rfc3339()),
            auth_provider: user.auth_provider,
            mfa_enabled: user.mfa_enabled,
        },
    };

    tracing::info!(user_id = %user_id, job_id = %job.id, "RGPD data export downloaded");

    Ok(Json(payload))
}
