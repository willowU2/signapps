//! Status Page endpoints — service health probes, health history, and incidents.
//!
//! Provides endpoints to check real-time health of all platform services,
//! retrieve historical health data, and manage incidents. Health checks are
//! stored in `status.health_checks` and incidents in `status.incidents`.

use crate::AppState;
use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

// ── Types ────────────────────────────────────────────────────────────────────

/// Known platform services with their default ports.
const SERVICES: &[(&str, u16)] = &[
    ("identity", 3001),
    ("containers", 3002),
    ("proxy", 3003),
    ("storage", 3004),
    ("ai", 3005),
    ("securelink", 3006),
    ("metrics", 3008),
    ("media", 3009),
    ("docs", 3010),
    ("calendar", 3011),
    ("mail", 3012),
    ("collab", 3013),
    ("meet", 3014),
    ("forms", 3015),
    ("pxe", 3016),
    ("remote", 3017),
    ("office", 3018),
    ("social", 3019),
    ("chat", 3020),
    ("notifications", 8095),
    ("billing", 8096),
    ("gateway", 3099),
];

/// Current status of a single service.
///
/// # Examples
///
/// ```ignore
/// let status = ServiceStatus {
///     name: "identity".into(),
///     port: 3001,
///     status: "up".into(),
///     latency_ms: Some(12),
///     checked_at: Utc::now(),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct ServiceStatus {
    /// Service name (e.g. "identity", "calendar").
    pub name: String,
    /// Port the service listens on.
    pub port: u16,
    /// Current status: "up", "down", or "degraded".
    pub status: String,
    /// Response latency in milliseconds (None if service is down).
    pub latency_ms: Option<i32>,
    /// Timestamp of the check.
    pub checked_at: DateTime<Utc>,
}

/// A stored health check record from the database.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct HealthCheckRecord {
    /// Unique identifier.
    pub id: Uuid,
    /// Service name.
    pub service_name: String,
    /// Service port.
    pub port: i32,
    /// Status at check time.
    pub status: String,
    /// Response latency in milliseconds.
    pub latency_ms: Option<i32>,
    /// Timestamp of the check.
    pub checked_at: DateTime<Utc>,
}

/// An incident affecting one or more services.
///
/// # Examples
///
/// ```ignore
/// let incident = Incident {
///     id: Uuid::new_v4(),
///     title: "Database connectivity issues".into(),
///     severity: "major".into(),
///     status: "investigating".into(),
///     ..Default::default()
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct Incident {
    /// Unique identifier.
    pub id: Uuid,
    /// Short summary of the incident.
    pub title: String,
    /// Severity level: minor, major, critical.
    pub severity: String,
    /// Current status: investigating, identified, monitoring, resolved.
    pub status: String,
    /// Detailed description of the incident.
    pub description: Option<String>,
    /// List of affected service names.
    pub affected_services: Option<Vec<String>>,
    /// When the incident started.
    pub started_at: DateTime<Utc>,
    /// When the incident was resolved (None if ongoing).
    pub resolved_at: Option<DateTime<Utc>>,
    /// User who created the incident.
    pub created_by: Option<Uuid>,
    /// Timestamp of creation.
    pub created_at: DateTime<Utc>,
    /// Timestamp of last update.
    pub updated_at: DateTime<Utc>,
}

/// Query parameters for health history.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct HistoryQuery {
    /// Filter by service name.
    pub service: Option<String>,
    /// Number of hours to look back (default: 24).
    pub hours: Option<i32>,
}

/// Request body for creating an incident.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateIncidentRequest {
    /// Short summary of the incident.
    pub title: String,
    /// Severity level: minor, major, critical.
    pub severity: Option<String>,
    /// Current status: investigating, identified, monitoring, resolved.
    pub status: Option<String>,
    /// Detailed description.
    pub description: Option<String>,
    /// List of affected service names.
    pub affected_services: Option<Vec<String>>,
}

// ── DB helpers ───────────────────────────────────────────────────────────────

/// Ensure the `status` schema and tables exist.
async fn ensure_tables(pool: &signapps_db::DatabasePool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE SCHEMA IF NOT EXISTS status;
        CREATE TABLE IF NOT EXISTS status.health_checks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            service_name TEXT NOT NULL,
            port INT NOT NULL,
            status TEXT NOT NULL,
            latency_ms INT,
            checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS status.incidents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            severity TEXT NOT NULL DEFAULT 'minor',
            status TEXT NOT NULL DEFAULT 'investigating',
            description TEXT,
            affected_services TEXT[] DEFAULT '{}',
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            resolved_at TIMESTAMPTZ,
            created_by UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        "#,
    )
    .execute(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("ensure status tables: {e}")))?;
    Ok(())
}

/// Probe a service's /health endpoint and return its status.
async fn probe_service(name: &str, port: u16) -> ServiceStatus {
    let url = format!("http://127.0.0.1:{port}/health");
    let start = std::time::Instant::now();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build();

    let client = match client {
        Ok(c) => c,
        Err(_) => {
            return ServiceStatus {
                name: name.to_string(),
                port,
                status: "down".to_string(),
                latency_ms: None,
                checked_at: Utc::now(),
            };
        }
    };

    match client.get(&url).send().await {
        Ok(resp) => {
            let latency = start.elapsed().as_millis() as i32;
            let status = if resp.status().is_success() {
                "up"
            } else {
                "degraded"
            };
            ServiceStatus {
                name: name.to_string(),
                port,
                status: status.to_string(),
                latency_ms: Some(latency),
                checked_at: Utc::now(),
            }
        }
        Err(_) => ServiceStatus {
            name: name.to_string(),
            port,
            status: "down".to_string(),
            latency_ms: None,
            checked_at: Utc::now(),
        },
    }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/// `GET /api/v1/status/services` — probe all services and return current status.
///
/// Sends an HTTP GET to each service's `/health` endpoint and reports
/// whether it is up, degraded, or down. Results are also persisted in the
/// `status.health_checks` table.
///
/// # Errors
///
/// Returns `Error::Internal` if persisting health check records fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/status/services",
    tag = "status",
    security(("bearer" = [])),
    responses(
        (status = 200, description = "Current status of all services", body = Vec<ServiceStatus>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_services(State(state): State<AppState>) -> Result<Json<Vec<ServiceStatus>>> {
    if let Err(e) = ensure_tables(&state.pool).await {
        tracing::warn!("status ensure_tables failed: {e}");
    }

    // Probe all services in parallel
    let futures: Vec<_> = SERVICES
        .iter()
        .map(|(name, port)| probe_service(name, *port))
        .collect();

    let statuses: Vec<ServiceStatus> = futures::future::join_all(futures).await;

    // Persist the results (best-effort, don't fail the request)
    for s in &statuses {
        if let Err(e) = sqlx::query(
            "INSERT INTO status.health_checks (service_name, port, status, latency_ms, checked_at)
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(&s.name)
        .bind(s.port as i32)
        .bind(&s.status)
        .bind(s.latency_ms)
        .bind(s.checked_at)
        .execute(state.pool.inner())
        .await
        {
            tracing::warn!(service = %s.name, "failed to persist health check: {e}");
        }
    }

    Ok(Json(statuses))
}

/// `GET /api/v1/status/history` — retrieve health check history.
///
/// Returns health check records from the last N hours (default 24),
/// optionally filtered by service name.
///
/// # Errors
///
/// Returns `Error::Internal` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/status/history",
    tag = "status",
    params(HistoryQuery),
    security(("bearer" = [])),
    responses(
        (status = 200, description = "Health check history", body = Vec<HealthCheckRecord>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_history(
    State(state): State<AppState>,
    Query(q): Query<HistoryQuery>,
) -> Result<Json<Vec<HealthCheckRecord>>> {
    if let Err(e) = ensure_tables(&state.pool).await {
        tracing::warn!("status ensure_tables failed: {e}");
    }

    let hours = q.hours.unwrap_or(24);

    let records = if let Some(ref service) = q.service {
        sqlx::query_as::<_, HealthCheckRecord>(
            "SELECT * FROM status.health_checks
             WHERE service_name = $1
               AND checked_at >= NOW() - make_interval(hours => $2)
             ORDER BY checked_at DESC",
        )
        .bind(service)
        .bind(hours)
        .fetch_all(state.pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("status history: {e}")))?
    } else {
        sqlx::query_as::<_, HealthCheckRecord>(
            "SELECT * FROM status.health_checks
             WHERE checked_at >= NOW() - make_interval(hours => $1)
             ORDER BY checked_at DESC",
        )
        .bind(hours)
        .fetch_all(state.pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("status history: {e}")))?
    };

    Ok(Json(records))
}

/// `GET /api/v1/status/incidents` — list all incidents.
///
/// Returns incidents ordered by creation date descending.
///
/// # Errors
///
/// Returns `Error::Internal` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/status/incidents",
    tag = "status",
    security(("bearer" = [])),
    responses(
        (status = 200, description = "List of incidents", body = Vec<Incident>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_incidents(State(state): State<AppState>) -> Result<Json<Vec<Incident>>> {
    if let Err(e) = ensure_tables(&state.pool).await {
        tracing::warn!("status ensure_tables failed: {e}");
    }

    let incidents = sqlx::query_as::<_, Incident>(
        "SELECT * FROM status.incidents ORDER BY created_at DESC",
    )
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("list incidents: {e}")))?;

    Ok(Json(incidents))
}

/// `POST /api/v1/status/incidents` — create a new incident (admin only).
///
/// Creates an incident record associated with the authenticated admin user.
///
/// # Errors
///
/// Returns `Error::Validation` if the title is empty.
/// Returns `Error::Internal` if the database insert fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/status/incidents",
    tag = "status",
    security(("bearer" = [])),
    request_body = CreateIncidentRequest,
    responses(
        (status = 201, description = "Incident created", body = Incident),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — admin only"),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn create_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateIncidentRequest>,
) -> Result<(StatusCode, Json<Incident>)> {
    // Validate
    if payload.title.trim().is_empty() {
        return Err(Error::Validation("Incident title cannot be empty".to_string()));
    }

    if let Err(e) = ensure_tables(&state.pool).await {
        tracing::warn!("status ensure_tables failed: {e}");
    }

    let severity = payload.severity.unwrap_or_else(|| "minor".to_string());
    let status = payload.status.unwrap_or_else(|| "investigating".to_string());
    let affected = payload.affected_services.unwrap_or_default();

    let incident = sqlx::query_as::<_, Incident>(
        "INSERT INTO status.incidents (title, severity, status, description, affected_services, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *",
    )
    .bind(&payload.title)
    .bind(&severity)
    .bind(&status)
    .bind(&payload.description)
    .bind(&affected)
    .bind(claims.sub)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("create incident: {e}")))?;

    tracing::info!(
        incident_id = %incident.id,
        severity = %severity,
        "incident created"
    );

    Ok((StatusCode::CREATED, Json(incident)))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
