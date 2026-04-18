//! Drive forensic audit log handlers.
//!
//! Endpoints:
//! - GET  /api/v1/drive/audit                  → list_audit
//! - GET  /api/v1/drive/audit/verify           → verify_chain
//! - POST /api/v1/drive/audit/export           → export_audit
//! - GET  /api/v1/drive/audit/alerts           → list_alerts
//! - GET  /api/v1/drive/audit/alerts/config    → get_alert_config
//! - PUT  /api/v1/drive/audit/alerts/config    → update_alert_config

use axum::{
    extract::{Query, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::json;
use signapps_common::auth::Claims;
use signapps_common::Result;
use signapps_db::models::drive_acl::{
    AuditAlertConfig, AuditLogFilters, ChainVerification, DriveAuditLog, UpdateAlertConfig,
};
use signapps_db::repositories::{AuditAlertConfigRepository, DriveAuditLogRepository};
use uuid::Uuid;

use crate::services::audit_chain;
use crate::AppState;

// ============================================================================
// Query parameter structs
// ============================================================================

/// Query parameters for listing audit log entries.
#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    /// Filter by drive node UUID.
    pub node_id: Option<Uuid>,
    /// Filter by actor (user) UUID.
    pub actor_id: Option<Uuid>,
    /// Filter by action name (e.g. "upload", "delete").
    pub action: Option<String>,
    /// ISO-8601 lower bound on `created_at`.
    pub since: Option<DateTime<Utc>>,
    /// ISO-8601 upper bound on `created_at`.
    pub until: Option<DateTime<Utc>>,
    /// Maximum number of rows to return (default 50, max 500).
    pub limit: Option<i64>,
    /// Row offset for pagination (default 0).
    pub offset: Option<i64>,
}

/// Query parameters for audit export.
#[derive(Debug, Deserialize)]
pub struct ExportQuery {
    /// Lower bound on `created_at`.
    pub since: Option<DateTime<Utc>>,
    /// Upper bound on `created_at`.
    pub until: Option<DateTime<Utc>>,
    /// Export format: "json" (default) or "csv".
    pub format: Option<String>,
}

/// Query parameters for listing alerts.
#[derive(Debug, Deserialize)]
pub struct AlertQuery {
    /// Organisation UUID; defaults to a nil UUID sentinel for single-tenant installs.
    pub org_id: Option<Uuid>,
}

// ============================================================================
// List audit log
// ============================================================================

/// GET /api/v1/drive/audit
///
/// Returns recent forensic audit log entries with optional filtering.
/// Requires at least admin role (enforced by the admin route layer in main.rs).
#[utoipa::path(
    get,
    path = "/api/v1/drive/audit",
    responses(
        (status = 200, description = "List of forensic audit log entries"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "audit"
)]
#[tracing::instrument(skip_all)]
pub async fn list_audit(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(q): Query<AuditQuery>,
) -> Result<Json<Vec<DriveAuditLog>>> {
    let limit = q.limit.unwrap_or(50).min(500);
    let offset = q.offset.unwrap_or(0).max(0);

    let filters = AuditLogFilters {
        node_id: q.node_id,
        actor_id: q.actor_id,
        action: q.action,
        since: q.since,
        until: q.until,
    };

    let repo = DriveAuditLogRepository::new(&state.pool);
    let logs = repo.list(&filters, limit, offset).await?;

    Ok(Json(logs))
}

// ============================================================================
// Verify audit chain
// ============================================================================

/// GET /api/v1/drive/audit/verify
///
/// Verifies the forensic integrity of the entire audit chain.
/// Returns whether the chain is intact and, if not, the index of the first
/// corrupted entry.
#[utoipa::path(
    get,
    path = "/api/v1/drive/audit/verify",
    responses(
        (status = 200, description = "Audit chain verification result"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "audit"
)]
#[tracing::instrument(skip_all)]
pub async fn verify_chain(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<ChainVerification>> {
    let result = audit_chain::verify_chain(state.pool.inner()).await?;
    Ok(Json(result))
}

// ============================================================================
// Export audit log
// ============================================================================

/// POST /api/v1/drive/audit/export
///
/// Exports a window of the audit log as JSON or CSV.
/// Returns the content as a JSON array (format=json) or plain CSV text.
#[utoipa::path(
    post,
    path = "/api/v1/drive/audit/export",
    responses(
        (status = 200, description = "Exported audit log data"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "audit"
)]
#[tracing::instrument(skip_all)]
pub async fn export_audit(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(q): Query<ExportQuery>,
) -> Result<(StatusCode, Json<serde_json::Value>)> {
    let filters = AuditLogFilters {
        node_id: None,
        actor_id: None,
        action: None,
        since: q.since,
        until: q.until,
    };

    let repo = DriveAuditLogRepository::new(&state.pool);
    // Export up to 10 000 entries
    let logs = repo.list(&filters, 10_000, 0).await?;
    let count = logs.len();

    let format = q.format.as_deref().unwrap_or("json");

    match format {
        "csv" => {
            // Build a simple CSV string and embed it in the JSON response
            let mut csv = String::from(
                "id,node_id,node_path,action,actor_id,actor_ip,file_hash,log_hash,created_at\n",
            );
            for entry in &logs {
                csv.push_str(&format!(
                    "{},{},{},{},{},{},{},{},{}\n",
                    entry.id,
                    entry.node_id.map(|u| u.to_string()).unwrap_or_default(),
                    entry.node_path,
                    entry.action,
                    entry.actor_id,
                    entry.actor_ip.as_deref().unwrap_or(""),
                    entry.file_hash.as_deref().unwrap_or(""),
                    entry.log_hash,
                    entry.created_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
                ));
            }
            Ok((
                StatusCode::OK,
                Json(json!({ "format": "csv", "data": csv, "count": count })),
            ))
        },
        _ => {
            // Default: JSON
            Ok((
                StatusCode::OK,
                Json(json!({ "format": "json", "data": logs, "count": count })),
            ))
        },
    }
}

// ============================================================================
// List recent alerts (fired events)
// ============================================================================

/// GET /api/v1/drive/audit/alerts
///
/// Returns recent audit log entries that match alert conditions —
/// specifically `access_denied` events in the last 24 hours.
#[utoipa::path(
    get,
    path = "/api/v1/drive/audit/alerts",
    responses(
        (status = 200, description = "List of recent audit alerts"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "audit"
)]
#[tracing::instrument(skip_all)]
pub async fn list_alerts(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<Vec<DriveAuditLog>>> {
    let since = Utc::now() - chrono::Duration::hours(24);

    let filters = AuditLogFilters {
        node_id: None,
        actor_id: None,
        action: Some("access_denied".into()),
        since: Some(since),
        until: None,
    };

    let repo = DriveAuditLogRepository::new(&state.pool);
    let logs = repo.list(&filters, 200, 0).await?;

    Ok(Json(logs))
}

// ============================================================================
// Get alert configuration
// ============================================================================

/// GET /api/v1/drive/audit/alerts/config
///
/// Returns all alert configurations for the organisation.
#[utoipa::path(
    get,
    path = "/api/v1/drive/audit/alerts/config",
    responses(
        (status = 200, description = "List of audit alert configurations"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "audit"
)]
#[tracing::instrument(skip_all)]
pub async fn get_alert_config(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(q): Query<AlertQuery>,
) -> Result<Json<Vec<AuditAlertConfig>>> {
    // Fall back to the nil UUID as a single-tenant sentinel when no org is provided
    let org_id = q.org_id.unwrap_or_else(Uuid::nil);

    let repo = AuditAlertConfigRepository::new(&state.pool);
    let configs = repo.list(org_id).await?;

    Ok(Json(configs))
}

// ============================================================================
// Update alert configuration
// ============================================================================

/// PUT /api/v1/drive/audit/alerts/config
///
/// Updates an alert configuration by its ID (passed as a query parameter or
/// in the request body).
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateAlertConfigRequest {
    /// UUID of the alert config row to update.
    pub id: Uuid,
    #[serde(flatten)]
    pub update: UpdateAlertConfig,
}

/// PUT /api/v1/drive/audit/alerts/config
#[utoipa::path(
    put,
    path = "/api/v1/drive/audit/alerts/config",
    request_body = UpdateAlertConfigRequest,
    responses(
        (status = 200, description = "Updated audit alert configuration"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "audit"
)]
#[tracing::instrument(skip_all)]
pub async fn update_alert_config(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<UpdateAlertConfigRequest>,
) -> Result<Json<AuditAlertConfig>> {
    let repo = AuditAlertConfigRepository::new(&state.pool);
    let config = repo.update(payload.id, payload.update).await?;

    Ok(Json(config))
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        let _ = module_path!();
    }
}
