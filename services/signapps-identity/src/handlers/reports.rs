//! Report Builder endpoints — saved report definitions and execution history.
//!
//! Reports are stored in the `reports` schema. Each definition describes a
//! data source, column selection, filters, and chart configuration. Executing
//! a report stores the result snapshot in `reports.executions`.
//!
//! # Endpoints
//!
//! - `GET    /api/v1/reports`                — list saved reports
//! - `POST   /api/v1/reports`                — save report definition
//! - `PUT    /api/v1/reports/:id`            — update report
//! - `DELETE /api/v1/reports/:id`            — delete report
//! - `POST   /api/v1/reports/:id/execute`    — execute report and return data
//! - `GET    /api/v1/reports/:id/executions` — execution history

use crate::AppState;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

// ── Types ────────────────────────────────────────────────────────────────────

/// Valid report data sources.
const VALID_SOURCES: &[&str] = &[
    "activities",
    "users",
    "files",
    "events",
    "tasks",
    "emails",
    "forms",
    "deals",
    "tickets",
];

/// Valid chart types.
const VALID_CHART_TYPES: &[&str] = &["table", "bar", "line", "pie", "donut", "area", "scatter"];

/// Report definition returned to the client.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct ReportResponse {
    /// Unique identifier.
    pub id: Uuid,
    /// Report name.
    pub name: String,
    /// Optional description.
    pub description: Option<String>,
    /// Data source name.
    pub source: String,
    /// Column definitions.
    pub columns: Value,
    /// Filter definitions.
    pub filters: Value,
    /// Chart type (table, bar, line, pie, donut, area, scatter).
    pub chart_type: String,
    /// Chart-specific configuration.
    pub chart_config: Value,
    /// Owner user UUID.
    pub owner_id: Uuid,
    /// UUIDs of users this report is shared with.
    pub shared_with: Vec<Uuid>,
    /// Optional CRON schedule for auto-execution.
    pub schedule_cron: Option<String>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Request body for creating or updating a report.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct SaveReportRequest {
    /// Report name.
    pub name: String,
    /// Optional description.
    pub description: Option<String>,
    /// Data source name.
    pub source: String,
    /// Column definitions: `[{field, label, aggregation, visible}]`.
    #[serde(default)]
    pub columns: Value,
    /// Filter definitions: `[{field, operator, value}]`.
    #[serde(default)]
    pub filters: Value,
    /// Chart type.
    #[serde(default = "default_chart_type")]
    pub chart_type: String,
    /// Chart configuration.
    #[serde(default = "default_json_object")]
    pub chart_config: Value,
    /// UUIDs of users to share with.
    #[serde(default)]
    pub shared_with: Vec<Uuid>,
    /// Optional CRON schedule for auto-execution.
    pub schedule_cron: Option<String>,
}

fn default_chart_type() -> String {
    "table".to_string()
}
fn default_json_object() -> Value {
    Value::Object(serde_json::Map::new())
}

/// Execution history item returned to the client.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct ExecutionResponse {
    /// Execution unique identifier.
    pub id: Uuid,
    /// Parent report definition UUID.
    pub report_id: Uuid,
    /// Snapshot of the result data.
    pub result_data: Value,
    /// Number of rows in the result.
    pub row_count: i32,
    /// Execution duration in milliseconds.
    pub execution_ms: Option<i32>,
    /// User who triggered the execution.
    pub executed_by: Option<Uuid>,
    /// Execution timestamp.
    pub executed_at: DateTime<Utc>,
}

// ── Validation ───────────────────────────────────────────────────────────────

fn validate_report(req: &SaveReportRequest) -> Result<()> {
    if req.name.trim().is_empty() {
        return Err(Error::BadRequest("Report name cannot be empty".to_string()));
    }
    if !VALID_SOURCES.contains(&req.source.as_str()) {
        return Err(Error::BadRequest(format!(
            "Invalid source '{}'. Valid sources: {}",
            req.source,
            VALID_SOURCES.join(", ")
        )));
    }
    if !VALID_CHART_TYPES.contains(&req.chart_type.as_str()) {
        return Err(Error::BadRequest(format!(
            "Invalid chart_type '{}'. Valid types: {}",
            req.chart_type,
            VALID_CHART_TYPES.join(", ")
        )));
    }
    Ok(())
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/// `GET /api/v1/reports` — list saved reports visible to the current user.
///
/// Returns reports owned by the user or shared with them, ordered by last
/// update time (newest first).
///
/// # Errors
///
/// Returns `Error::Internal` if the database query fails.
#[utoipa::path(
    get,
    path = "/api/v1/reports",
    tag = "reports",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of report definitions", body = Vec<ReportResponse>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id))]
pub async fn list_reports(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ReportResponse>>> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            Option<String>,
            String,
            Value,
            Value,
            String,
            Value,
            Uuid,
            Vec<Uuid>,
            Option<String>,
            DateTime<Utc>,
            DateTime<Utc>,
        ),
    >(
        r#"SELECT id, name, description, source, columns, filters,
                  chart_type, chart_config, owner_id, shared_with,
                  schedule_cron, created_at, updated_at
           FROM reports.definitions
           WHERE owner_id = $1 OR $1 = ANY(shared_with)
           ORDER BY updated_at DESC"#,
    )
    .bind(claims.sub)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("list reports: {e}")))?;

    let items = rows
        .into_iter()
        .map(|r| ReportResponse {
            id: r.0,
            name: r.1,
            description: r.2,
            source: r.3,
            columns: r.4,
            filters: r.5,
            chart_type: r.6,
            chart_config: r.7,
            owner_id: r.8,
            shared_with: r.9,
            schedule_cron: r.10,
            created_at: r.11,
            updated_at: r.12,
        })
        .collect();

    Ok(Json(items))
}

/// `POST /api/v1/reports` — save a new report definition.
///
/// The `owner_id` is set from the authenticated user's claims.
///
/// # Errors
///
/// Returns `Error::BadRequest` if validation fails (invalid source, chart type, or empty name).
/// Returns `Error::Internal` on database failure.
#[utoipa::path(
    post,
    path = "/api/v1/reports",
    tag = "reports",
    security(("bearerAuth" = [])),
    request_body = SaveReportRequest,
    responses(
        (status = 201, description = "Report created", body = ReportResponse),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id))]
pub async fn create_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SaveReportRequest>,
) -> Result<(StatusCode, Json<ReportResponse>)> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));
    validate_report(&body)?;

    let row = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            Option<String>,
            String,
            Value,
            Value,
            String,
            Value,
            Uuid,
            Vec<Uuid>,
            Option<String>,
            DateTime<Utc>,
            DateTime<Utc>,
        ),
    >(
        r#"INSERT INTO reports.definitions
            (name, description, source, columns, filters, chart_type,
             chart_config, owner_id, shared_with, schedule_cron)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, name, description, source, columns, filters,
                  chart_type, chart_config, owner_id, shared_with,
                  schedule_cron, created_at, updated_at"#,
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.source)
    .bind(&body.columns)
    .bind(&body.filters)
    .bind(&body.chart_type)
    .bind(&body.chart_config)
    .bind(claims.sub)
    .bind(&body.shared_with)
    .bind(&body.schedule_cron)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("create report: {e}")))?;

    tracing::info!(report_id = %row.0, "report created");

    Ok((
        StatusCode::CREATED,
        Json(ReportResponse {
            id: row.0,
            name: row.1,
            description: row.2,
            source: row.3,
            columns: row.4,
            filters: row.5,
            chart_type: row.6,
            chart_config: row.7,
            owner_id: row.8,
            shared_with: row.9,
            schedule_cron: row.10,
            created_at: row.11,
            updated_at: row.12,
        }),
    ))
}

/// `PUT /api/v1/reports/:id` — update an existing report definition.
///
/// Only the report owner can update it.
///
/// # Errors
///
/// Returns `Error::BadRequest` if validation fails.
/// Returns `Error::NotFound` if the report does not exist or is not owned by the user.
/// Returns `Error::Internal` on database failure.
#[utoipa::path(
    put,
    path = "/api/v1/reports/{id}",
    tag = "reports",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Report UUID")),
    request_body = SaveReportRequest,
    responses(
        (status = 200, description = "Report updated", body = ReportResponse),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Report not found"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id, report_id = %id))]
pub async fn update_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SaveReportRequest>,
) -> Result<Json<ReportResponse>> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));
    validate_report(&body)?;

    let row = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            Option<String>,
            String,
            Value,
            Value,
            String,
            Value,
            Uuid,
            Vec<Uuid>,
            Option<String>,
            DateTime<Utc>,
            DateTime<Utc>,
        ),
    >(
        r#"UPDATE reports.definitions SET
            name = $3, description = $4, source = $5, columns = $6,
            filters = $7, chart_type = $8, chart_config = $9,
            shared_with = $10, schedule_cron = $11, updated_at = NOW()
        WHERE id = $1 AND owner_id = $2
        RETURNING id, name, description, source, columns, filters,
                  chart_type, chart_config, owner_id, shared_with,
                  schedule_cron, created_at, updated_at"#,
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.source)
    .bind(&body.columns)
    .bind(&body.filters)
    .bind(&body.chart_type)
    .bind(&body.chart_config)
    .bind(&body.shared_with)
    .bind(&body.schedule_cron)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("update report: {e}")))?;

    let row = match row {
        Some(r) => r,
        None => return Err(Error::NotFound("Report not found".to_string())),
    };

    tracing::info!("report updated");

    Ok(Json(ReportResponse {
        id: row.0,
        name: row.1,
        description: row.2,
        source: row.3,
        columns: row.4,
        filters: row.5,
        chart_type: row.6,
        chart_config: row.7,
        owner_id: row.8,
        shared_with: row.9,
        schedule_cron: row.10,
        created_at: row.11,
        updated_at: row.12,
    }))
}

/// `DELETE /api/v1/reports/:id` — delete a report definition.
///
/// Cascades to `reports.executions` via the foreign key constraint.
/// Only the report owner can delete it.
///
/// # Errors
///
/// Returns `Error::NotFound` if the report does not exist or is not owned by the user.
/// Returns `Error::Internal` on database failure.
#[utoipa::path(
    delete,
    path = "/api/v1/reports/{id}",
    tag = "reports",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Report UUID")),
    responses(
        (status = 204, description = "Report deleted"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Report not found"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id, report_id = %id))]
pub async fn delete_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    let result = sqlx::query("DELETE FROM reports.definitions WHERE id = $1 AND owner_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&*state.pool)
        .await
        .map_err(|e| Error::Internal(format!("delete report: {e}")))?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound("Report not found".to_string()));
    }

    tracing::info!("report deleted");
    Ok(StatusCode::NO_CONTENT)
}

/// `POST /api/v1/reports/:id/execute` — execute a report and return data.
///
/// Builds a dynamic query based on the report's `source` and `filters`,
/// stores the result in `reports.executions`, and returns the data.
/// Currently returns a placeholder result — real execution will be
/// implemented when the underlying data-source query engine is available.
///
/// # Errors
///
/// Returns `Error::NotFound` if the report does not exist or the user lacks access.
/// Returns `Error::Internal` on database failure.
#[utoipa::path(
    post,
    path = "/api/v1/reports/{id}/execute",
    tag = "reports",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Report UUID")),
    responses(
        (status = 200, description = "Execution result", body = ExecutionResponse),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Report not found"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id, report_id = %id))]
pub async fn execute_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ExecutionResponse>> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));
    let start = std::time::Instant::now();

    // Verify the report exists and the user has access
    let report = sqlx::query_as::<_, (Uuid, String, Value, Value)>(
        r#"SELECT id, source, columns, filters
           FROM reports.definitions
           WHERE id = $1 AND (owner_id = $2 OR $2 = ANY(shared_with))"#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("fetch report: {e}")))?;

    let (_report_id, source, columns, filters) = match report {
        Some(r) => r,
        None => return Err(Error::NotFound("Report not found".to_string())),
    };

    // Execute the report query based on source
    // This is a simplified execution — a real implementation would build
    // dynamic SQL from columns/filters. For now we produce a summary row.
    let result_data = serde_json::json!({
        "source": source,
        "columns": columns,
        "filters": filters,
        "rows": [],
        "message": "Report executed — dynamic query engine pending implementation"
    });
    let row_count: i32 = 0;
    let execution_ms = start.elapsed().as_millis() as i32;

    // Store execution snapshot
    let exec_row = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            Value,
            i32,
            Option<i32>,
            Option<Uuid>,
            DateTime<Utc>,
        ),
    >(
        r#"INSERT INTO reports.executions
            (report_id, result_data, row_count, execution_ms, executed_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, report_id, result_data, row_count, execution_ms, executed_by, executed_at"#,
    )
    .bind(id)
    .bind(&result_data)
    .bind(row_count)
    .bind(execution_ms)
    .bind(claims.sub)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("store execution: {e}")))?;

    tracing::info!(execution_ms = execution_ms, "report executed");

    Ok(Json(ExecutionResponse {
        id: exec_row.0,
        report_id: exec_row.1,
        result_data: exec_row.2,
        row_count: exec_row.3,
        execution_ms: exec_row.4,
        executed_by: exec_row.5,
        executed_at: exec_row.6,
    }))
}

/// `GET /api/v1/reports/:id/executions` — get execution history.
///
/// Returns the most recent 50 executions for the given report,
/// ordered by execution time (newest first). Only accessible to
/// the report owner or shared users.
///
/// # Errors
///
/// Returns `Error::NotFound` if the report does not exist or the user lacks access.
/// Returns `Error::Internal` on database failure.
#[utoipa::path(
    get,
    path = "/api/v1/reports/{id}/executions",
    tag = "reports",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Report UUID")),
    responses(
        (status = 200, description = "Execution history", body = Vec<ExecutionResponse>),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Report not found"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id, report_id = %id))]
pub async fn list_executions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<ExecutionResponse>>> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    // Verify access
    let exists = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(
            SELECT 1 FROM reports.definitions
            WHERE id = $1 AND (owner_id = $2 OR $2 = ANY(shared_with))
        )"#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("check report access: {e}")))?;

    if !exists {
        return Err(Error::NotFound("Report not found".to_string()));
    }

    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            Value,
            i32,
            Option<i32>,
            Option<Uuid>,
            DateTime<Utc>,
        ),
    >(
        r#"SELECT id, report_id, result_data, row_count, execution_ms,
                  executed_by, executed_at
           FROM reports.executions
           WHERE report_id = $1
           ORDER BY executed_at DESC
           LIMIT 50"#,
    )
    .bind(id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("list executions: {e}")))?;

    let items = rows
        .into_iter()
        .map(|r| ExecutionResponse {
            id: r.0,
            report_id: r.1,
            result_data: r.2,
            row_count: r.3,
            execution_ms: r.4,
            executed_by: r.5,
            executed_at: r.6,
        })
        .collect();

    Ok(Json(items))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn module_compiles() {
        // Placeholder: ensures the module compiles.
        let _ = module_path!();
    }

    #[test]
    fn validate_rejects_empty_name() {
        let req = SaveReportRequest {
            name: "".to_string(),
            description: None,
            source: "users".to_string(),
            columns: Value::Array(vec![]),
            filters: Value::Array(vec![]),
            chart_type: "table".to_string(),
            chart_config: Value::Object(serde_json::Map::new()),
            shared_with: vec![],
            schedule_cron: None,
        };
        assert!(validate_report(&req).is_err());
    }

    #[test]
    fn validate_rejects_invalid_source() {
        let req = SaveReportRequest {
            name: "Test".to_string(),
            description: None,
            source: "invalid_source".to_string(),
            columns: Value::Array(vec![]),
            filters: Value::Array(vec![]),
            chart_type: "table".to_string(),
            chart_config: Value::Object(serde_json::Map::new()),
            shared_with: vec![],
            schedule_cron: None,
        };
        assert!(validate_report(&req).is_err());
    }

    #[test]
    fn validate_rejects_invalid_chart_type() {
        let req = SaveReportRequest {
            name: "Test".to_string(),
            description: None,
            source: "users".to_string(),
            columns: Value::Array(vec![]),
            filters: Value::Array(vec![]),
            chart_type: "bubble".to_string(),
            chart_config: Value::Object(serde_json::Map::new()),
            shared_with: vec![],
            schedule_cron: None,
        };
        assert!(validate_report(&req).is_err());
    }

    #[test]
    fn validate_accepts_valid_request() {
        let req = SaveReportRequest {
            name: "User Activity".to_string(),
            description: Some("Weekly overview".to_string()),
            source: "activities".to_string(),
            columns: Value::Array(vec![]),
            filters: Value::Array(vec![]),
            chart_type: "bar".to_string(),
            chart_config: Value::Object(serde_json::Map::new()),
            shared_with: vec![],
            schedule_cron: None,
        };
        assert!(validate_report(&req).is_ok());
    }

    #[test]
    fn default_chart_type_is_table() {
        assert_eq!(default_chart_type(), "table");
    }

    #[test]
    fn default_json_object_is_empty() {
        assert_eq!(default_json_object(), Value::Object(serde_json::Map::new()));
    }
}
