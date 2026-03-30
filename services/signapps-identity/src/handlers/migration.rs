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
// Migration worker — provider-specific logic
// =============================================================================

/// Configuration passed to the background worker for a migration job.
#[derive(Debug, Clone)]
pub struct MigrationWorkerConfig {
    /// Unique job identifier (for progress updates).
    pub job_id: Uuid,
    /// OAuth2 access token obtained from the user's SSO session.
    pub oauth_token: String,
    /// Base URL of the internal contacts service.
    pub contacts_service_url: String,
    /// Base URL of the internal calendar service.
    pub calendar_service_url: String,
}

/// Unified contact payload forwarded to the contacts service.
#[derive(Debug, Serialize)]
struct ImportContact {
    first_name: String,
    last_name: String,
    email: Option<String>,
    phone: Option<String>,
    organization: Option<String>,
    job_title: Option<String>,
}

/// Unified calendar event payload forwarded to the calendar service.
#[derive(Debug, Serialize)]
struct ImportCalendarEvent {
    title: String,
    description: Option<String>,
    start_time: String,
    end_time: String,
    location: Option<String>,
}

// ---------------------------------------------------------------------------
// Google Workspace worker
// ---------------------------------------------------------------------------

/// Drive the Google Workspace migration:
///  1. Fetch contacts via the People API (`/v1/people/me/connections`)
///  2. Fetch calendar events via the Calendar API (`/calendar/v3/calendars/primary/events`)
///  3. POST each item to the respective internal services
///  4. Update job progress in the store as work progresses
pub async fn run_google_migration(store: MigrationStore, cfg: MigrationWorkerConfig) {
    let client = reqwest::Client::new();
    let bearer = format!("Bearer {}", cfg.oauth_token);

    // --- Step 1: contacts ---
    update_step(&store, cfg.job_id, "Fetching Google contacts").await;

    let contacts_result = client
        .get("https://people.googleapis.com/v1/people/me/connections")
        .header("Authorization", &bearer)
        .query(&[(
            "personFields",
            "names,emailAddresses,phoneNumbers,organizations",
        )])
        .send()
        .await;

    let contacts: Vec<ImportContact> = match contacts_result {
        Ok(resp) if resp.status().is_success() => match resp.json::<serde_json::Value>().await {
            Ok(body) => parse_google_contacts(&body),
            Err(e) => {
                tracing::error!(job_id = %cfg.job_id, "Failed to parse Google contacts: {e}");
                vec![]
            },
        },
        Ok(resp) => {
            tracing::warn!(job_id = %cfg.job_id, status = %resp.status(), "Google People API returned non-200");
            vec![]
        },
        Err(e) => {
            tracing::error!(job_id = %cfg.job_id, "Google People API request failed: {e}");
            mark_failed(&store, cfg.job_id).await;
            return;
        },
    };

    let total_contacts = contacts.len() as u32;
    update_progress_counts(
        &store,
        cfg.job_id,
        0,
        total_contacts,
        0,
        "Importing contacts",
    )
    .await;

    let mut imported_contacts = 0u32;
    for contact in contacts {
        let url = format!("{}/api/v1/contacts", cfg.contacts_service_url);
        match client
            .post(&url)
            .header("Authorization", &bearer)
            .json(&contact)
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => imported_contacts += 1,
            Ok(r) => {
                tracing::warn!(job_id = %cfg.job_id, status = %r.status(), "Contact import failed")
            },
            Err(e) => tracing::error!(job_id = %cfg.job_id, "Contact POST error: {e}"),
        }
        update_progress_counts(
            &store,
            cfg.job_id,
            imported_contacts,
            total_contacts,
            0,
            "Importing contacts",
        )
        .await;
    }

    // --- Step 2: calendar events ---
    update_step(&store, cfg.job_id, "Fetching Google Calendar events").await;

    let events_result = client
        .get("https://www.googleapis.com/calendar/v3/calendars/primary/events")
        .header("Authorization", &bearer)
        .query(&[("maxResults", "2500"), ("singleEvents", "true")])
        .send()
        .await;

    let events: Vec<ImportCalendarEvent> = match events_result {
        Ok(resp) if resp.status().is_success() => match resp.json::<serde_json::Value>().await {
            Ok(body) => parse_google_events(&body),
            Err(e) => {
                tracing::error!(job_id = %cfg.job_id, "Failed to parse Google events: {e}");
                vec![]
            },
        },
        Ok(resp) => {
            tracing::warn!(job_id = %cfg.job_id, status = %resp.status(), "Google Calendar API returned non-200");
            vec![]
        },
        Err(e) => {
            tracing::error!(job_id = %cfg.job_id, "Google Calendar API request failed: {e}");
            // Non-fatal: contacts were imported, we just skip calendar
            vec![]
        },
    };

    let total_events = events.len() as u32;
    let total_items = total_contacts + total_events;
    update_progress_counts(
        &store,
        cfg.job_id,
        imported_contacts,
        total_items,
        0,
        "Importing calendar events",
    )
    .await;

    let mut imported_events = 0u32;
    for event in events {
        let url = format!("{}/api/v1/events", cfg.calendar_service_url);
        match client
            .post(&url)
            .header("Authorization", &bearer)
            .json(&event)
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => imported_events += 1,
            Ok(r) => {
                tracing::warn!(job_id = %cfg.job_id, status = %r.status(), "Event import failed")
            },
            Err(e) => tracing::error!(job_id = %cfg.job_id, "Event POST error: {e}"),
        }
        update_progress_counts(
            &store,
            cfg.job_id,
            imported_contacts + imported_events,
            total_items,
            0,
            "Importing calendar events",
        )
        .await;
    }

    mark_completed(
        &store,
        cfg.job_id,
        imported_contacts + imported_events,
        total_items,
    )
    .await;
    tracing::info!(job_id = %cfg.job_id, "Google migration completed");
}

/// Parse the Google People API response into our internal contact format.
fn parse_google_contacts(body: &serde_json::Value) -> Vec<ImportContact> {
    let connections = match body.get("connections").and_then(|v| v.as_array()) {
        Some(c) => c,
        None => return vec![],
    };

    connections
        .iter()
        .filter_map(|person| {
            let names = person.get("names")?.as_array()?;
            let primary_name = names.first()?;
            let first_name = primary_name
                .get("givenName")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let last_name = primary_name
                .get("familyName")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let email = person
                .get("emailAddresses")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|e| e.get("value"))
                .and_then(|v| v.as_str())
                .map(str::to_string);

            let phone = person
                .get("phoneNumbers")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|p| p.get("value"))
                .and_then(|v| v.as_str())
                .map(str::to_string);

            let org = person
                .get("organizations")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first());
            let organization = org
                .and_then(|o| o.get("name"))
                .and_then(|v| v.as_str())
                .map(str::to_string);
            let job_title = org
                .and_then(|o| o.get("title"))
                .and_then(|v| v.as_str())
                .map(str::to_string);

            Some(ImportContact {
                first_name,
                last_name,
                email,
                phone,
                organization,
                job_title,
            })
        })
        .collect()
}

/// Parse the Google Calendar API events response.
fn parse_google_events(body: &serde_json::Value) -> Vec<ImportCalendarEvent> {
    let items = match body.get("items").and_then(|v| v.as_array()) {
        Some(i) => i,
        None => return vec![],
    };

    items
        .iter()
        .filter_map(|item| {
            let title = item.get("summary")?.as_str()?.to_string();
            let description = item
                .get("description")
                .and_then(|v| v.as_str())
                .map(str::to_string);
            let location = item
                .get("location")
                .and_then(|v| v.as_str())
                .map(str::to_string);

            // Events can have dateTime or date (all-day)
            let start = item.get("start")?;
            let start_time = start
                .get("dateTime")
                .or_else(|| start.get("date"))
                .and_then(|v| v.as_str())
                .map(str::to_string)?;

            let end = item.get("end")?;
            let end_time = end
                .get("dateTime")
                .or_else(|| end.get("date"))
                .and_then(|v| v.as_str())
                .map(str::to_string)?;

            Some(ImportCalendarEvent {
                title,
                description,
                start_time,
                end_time,
                location,
            })
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Microsoft Graph worker
// ---------------------------------------------------------------------------

/// Drive the Microsoft Office 365 migration:
///  1. Fetch contacts via MS Graph (`/v1.0/me/contacts`)
///  2. Fetch calendar events via MS Graph (`/v1.0/me/events`)
///  3. POST each item to the respective internal services
pub async fn run_microsoft_migration(store: MigrationStore, cfg: MigrationWorkerConfig) {
    let client = reqwest::Client::new();
    let bearer = format!("Bearer {}", cfg.oauth_token);

    // --- Step 1: contacts ---
    update_step(&store, cfg.job_id, "Fetching Microsoft contacts").await;

    let contacts_result = client
        .get("https://graph.microsoft.com/v1.0/me/contacts")
        .header("Authorization", &bearer)
        .query(&[
            (
                "$select",
                "displayName,givenName,surname,emailAddresses,mobilePhone,companyName,jobTitle",
            ),
            ("$top", "1000"),
        ])
        .send()
        .await;

    let contacts: Vec<ImportContact> = match contacts_result {
        Ok(resp) if resp.status().is_success() => match resp.json::<serde_json::Value>().await {
            Ok(body) => parse_ms_contacts(&body),
            Err(e) => {
                tracing::error!(job_id = %cfg.job_id, "Failed to parse MS contacts: {e}");
                vec![]
            },
        },
        Ok(resp) => {
            tracing::warn!(job_id = %cfg.job_id, status = %resp.status(), "MS Graph contacts returned non-200");
            vec![]
        },
        Err(e) => {
            tracing::error!(job_id = %cfg.job_id, "MS Graph contacts request failed: {e}");
            mark_failed(&store, cfg.job_id).await;
            return;
        },
    };

    let total_contacts = contacts.len() as u32;
    update_progress_counts(
        &store,
        cfg.job_id,
        0,
        total_contacts,
        0,
        "Importing contacts",
    )
    .await;

    let mut imported_contacts = 0u32;
    for contact in contacts {
        let url = format!("{}/api/v1/contacts", cfg.contacts_service_url);
        match client
            .post(&url)
            .header("Authorization", &bearer)
            .json(&contact)
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => imported_contacts += 1,
            Ok(r) => {
                tracing::warn!(job_id = %cfg.job_id, status = %r.status(), "Contact import failed")
            },
            Err(e) => tracing::error!(job_id = %cfg.job_id, "Contact POST error: {e}"),
        }
        update_progress_counts(
            &store,
            cfg.job_id,
            imported_contacts,
            total_contacts,
            0,
            "Importing contacts",
        )
        .await;
    }

    // --- Step 2: calendar events ---
    update_step(&store, cfg.job_id, "Fetching Microsoft calendar events").await;

    let events_result = client
        .get("https://graph.microsoft.com/v1.0/me/events")
        .header("Authorization", &bearer)
        .query(&[
            ("$select", "subject,body,start,end,location"),
            ("$top", "1000"),
        ])
        .send()
        .await;

    let events: Vec<ImportCalendarEvent> = match events_result {
        Ok(resp) if resp.status().is_success() => match resp.json::<serde_json::Value>().await {
            Ok(body) => parse_ms_events(&body),
            Err(e) => {
                tracing::error!(job_id = %cfg.job_id, "Failed to parse MS events: {e}");
                vec![]
            },
        },
        Ok(resp) => {
            tracing::warn!(job_id = %cfg.job_id, status = %resp.status(), "MS Graph events returned non-200");
            vec![]
        },
        Err(e) => {
            tracing::error!(job_id = %cfg.job_id, "MS Graph events request failed: {e}");
            vec![]
        },
    };

    let total_events = events.len() as u32;
    let total_items = total_contacts + total_events;

    let mut imported_events = 0u32;
    for event in events {
        let url = format!("{}/api/v1/events", cfg.calendar_service_url);
        match client
            .post(&url)
            .header("Authorization", &bearer)
            .json(&event)
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => imported_events += 1,
            Ok(r) => {
                tracing::warn!(job_id = %cfg.job_id, status = %r.status(), "Event import failed")
            },
            Err(e) => tracing::error!(job_id = %cfg.job_id, "Event POST error: {e}"),
        }
        update_progress_counts(
            &store,
            cfg.job_id,
            imported_contacts + imported_events,
            total_items,
            0,
            "Importing calendar events",
        )
        .await;
    }

    mark_completed(
        &store,
        cfg.job_id,
        imported_contacts + imported_events,
        total_items,
    )
    .await;
    tracing::info!(job_id = %cfg.job_id, "Microsoft migration completed");
}

/// Parse the MS Graph `/me/contacts` response.
fn parse_ms_contacts(body: &serde_json::Value) -> Vec<ImportContact> {
    let items = match body.get("value").and_then(|v| v.as_array()) {
        Some(i) => i,
        None => return vec![],
    };

    items
        .iter()
        .map(|item| {
            let first_name = item
                .get("givenName")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let last_name = item
                .get("surname")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let email = item
                .get("emailAddresses")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|e| e.get("address"))
                .and_then(|v| v.as_str())
                .map(str::to_string);
            let phone = item
                .get("mobilePhone")
                .and_then(|v| v.as_str())
                .map(str::to_string);
            let organization = item
                .get("companyName")
                .and_then(|v| v.as_str())
                .map(str::to_string);
            let job_title = item
                .get("jobTitle")
                .and_then(|v| v.as_str())
                .map(str::to_string);

            ImportContact {
                first_name,
                last_name,
                email,
                phone,
                organization,
                job_title,
            }
        })
        .collect()
}

/// Parse the MS Graph `/me/events` response.
fn parse_ms_events(body: &serde_json::Value) -> Vec<ImportCalendarEvent> {
    let items = match body.get("value").and_then(|v| v.as_array()) {
        Some(i) => i,
        None => return vec![],
    };

    items
        .iter()
        .filter_map(|item| {
            let title = item.get("subject")?.as_str()?.to_string();
            let description = item
                .get("body")
                .and_then(|b| b.get("content"))
                .and_then(|v| v.as_str())
                .map(str::to_string);
            let location = item
                .get("location")
                .and_then(|l| l.get("displayName"))
                .and_then(|v| v.as_str())
                .map(str::to_string);
            let start_time = item
                .get("start")
                .and_then(|s| s.get("dateTime"))
                .and_then(|v| v.as_str())
                .map(str::to_string)?;
            let end_time = item
                .get("end")
                .and_then(|s| s.get("dateTime"))
                .and_then(|v| v.as_str())
                .map(str::to_string)?;

            Some(ImportCalendarEvent {
                title,
                description,
                start_time,
                end_time,
                location,
            })
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Shared progress helpers
// ---------------------------------------------------------------------------

async fn update_step(store: &MigrationStore, job_id: Uuid, step: &str) {
    if let Some(mut job) = store.get().await {
        if job.id == job_id {
            job.progress.current_step = step.to_string();
            job.status = MigrationStatus::Running;
            store.set(job).await;
        }
    }
}

async fn update_progress_counts(
    store: &MigrationStore,
    job_id: Uuid,
    processed: u32,
    total: u32,
    failed: u32,
    step: &str,
) {
    if let Some(mut job) = store.get().await {
        if job.id == job_id {
            job.progress.total_items = total;
            job.progress.processed_items = processed;
            job.progress.failed_items = failed;
            job.progress.current_step = step.to_string();
            store.set(job).await;
        }
    }
}

async fn mark_completed(store: &MigrationStore, job_id: Uuid, processed: u32, total: u32) {
    if let Some(mut job) = store.get().await {
        if job.id == job_id {
            job.status = MigrationStatus::Completed;
            job.progress.processed_items = processed;
            job.progress.total_items = total;
            job.progress.current_step = "Done".to_string();
            job.completed_at = Some(Utc::now());
            store.set(job).await;
        }
    }
}

async fn mark_failed(store: &MigrationStore, job_id: Uuid) {
    if let Some(mut job) = store.get().await {
        if job.id == job_id {
            job.status = MigrationStatus::Failed;
            job.progress.current_step = "Failed".to_string();
            job.completed_at = Some(Utc::now());
            store.set(job).await;
        }
    }
}

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
    /// OAuth2 access token for the user's provider account.
    /// Required for Google and Microsoft sources; ignored for Custom.
    pub oauth_token: Option<String>,
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
/// Creates and starts a new migration job, then spawns a background worker
/// that fetches data from the external provider and forwards it to the
/// internal contacts and calendar services.
///
/// The request body may include an `oauth_token` field (used by the worker).
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
        source: payload.source.clone(),
        status: MigrationStatus::Running,
        progress: MigrationProgress {
            current_step: "Starting".to_string(),
            ..Default::default()
        },
        started_at: Utc::now(),
        completed_at: None,
    };

    state.migration.set(job.clone()).await;
    tracing::info!(job_id = %job.id, source = ?job.source, "Migration job started");

    // Spawn background worker
    let worker_cfg = MigrationWorkerConfig {
        job_id: job.id,
        oauth_token: payload.oauth_token.unwrap_or_default(),
        contacts_service_url: std::env::var("CONTACTS_SERVICE_URL")
            .unwrap_or_else(|_| "http://localhost:3014".to_string()),
        calendar_service_url: std::env::var("CALENDAR_SERVICE_URL")
            .unwrap_or_else(|_| "http://localhost:3006".to_string()),
    };
    let store_clone = state.migration.clone();

    match payload.source {
        MigrationSource::GoogleWorkspace => {
            tokio::spawn(run_google_migration(store_clone, worker_cfg));
        },
        MigrationSource::MicrosoftOffice365 => {
            tokio::spawn(run_microsoft_migration(store_clone, worker_cfg));
        },
        MigrationSource::Custom => {
            // Custom sources are handled by the caller via progress updates
            tracing::info!(job_id = %job.id, "Custom migration — caller drives progress");
        },
    }

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
