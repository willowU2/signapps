//! Audit log handlers — SYNC-AUDIT-ROUTES
//!
//! Provides GET /api/v1/audit-logs (list with filters), GET /api/v1/audit-logs/:id,
//! GET /api/v1/audit-logs/export (CSV), and POST /api/v1/audit (query endpoint).

use axum::{
    extract::{Extension, Path, Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use sqlx::FromRow;
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
/// AuditLog data transfer object.
pub struct AuditLog {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub username: Option<String>,
    pub action: String,
    pub resource_type: Option<String>,
    pub resource_id: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub details: Option<serde_json::Value>,
    pub status: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
/// AuditLogFilters data transfer object.
pub struct AuditLogFilters {
    pub user_id: Option<Uuid>,
    pub username: Option<String>,
    pub action: Option<String>,
    pub resource_type: Option<String>,
    pub status: Option<String>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
/// Response for AuditLogList.
pub struct AuditLogListResponse {
    pub logs: Vec<AuditLog>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /api/v1/audit-logs
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_audit_logs(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(filters): Query<AuditLogFilters>,
) -> impl IntoResponse {
    let limit = filters.limit.unwrap_or(50).clamp(1, 500);
    let offset = filters.offset.unwrap_or(0);

    let count_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM identity.audit_logs
         WHERE ($1::uuid IS NULL OR user_id = $1)
           AND ($2::text IS NULL OR username ILIKE '%' || $2 || '%')
           AND ($3::text IS NULL OR action = $3)
           AND ($4::text IS NULL OR resource_type = $4)
           AND ($5::text IS NULL OR status = $5)
           AND ($6::timestamptz IS NULL OR created_at >= $6)
           AND ($7::timestamptz IS NULL OR created_at <= $7)",
    )
    .bind(filters.user_id)
    .bind(&filters.username)
    .bind(&filters.action)
    .bind(&filters.resource_type)
    .bind(&filters.status)
    .bind(filters.start_date)
    .bind(filters.end_date)
    .fetch_one(&*state.pool)
    .await;

    let total = count_result.unwrap_or(0);

    let rows = sqlx::query_as::<_, AuditLog>(
        "SELECT id, user_id, username, action, resource_type, resource_id,
                ip_address, user_agent, details, status, created_at
         FROM identity.audit_logs
         WHERE ($1::uuid IS NULL OR user_id = $1)
           AND ($2::text IS NULL OR username ILIKE '%' || $2 || '%')
           AND ($3::text IS NULL OR action = $3)
           AND ($4::text IS NULL OR resource_type = $4)
           AND ($5::text IS NULL OR status = $5)
           AND ($6::timestamptz IS NULL OR created_at >= $6)
           AND ($7::timestamptz IS NULL OR created_at <= $7)
         ORDER BY created_at DESC
         LIMIT $8 OFFSET $9",
    )
    .bind(filters.user_id)
    .bind(&filters.username)
    .bind(&filters.action)
    .bind(&filters.resource_type)
    .bind(&filters.status)
    .bind(filters.start_date)
    .bind(filters.end_date)
    .bind(limit)
    .bind(offset)
    .fetch_all(&*state.pool)
    .await;

    match rows {
        Ok(logs) => (
            StatusCode::OK,
            Json(serde_json::json!(AuditLogListResponse {
                logs,
                total,
                limit,
                offset,
            })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("list_audit_logs: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
                .into_response()
        },
    }
}

/// GET /api/v1/audit-logs/:id
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_audit_log(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, AuditLog>(
        "SELECT id, user_id, username, action, resource_type, resource_id,
                ip_address, user_agent, details, status, created_at
         FROM identity.audit_logs WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&*state.pool)
    .await
    {
        Ok(Some(log)) => (StatusCode::OK, Json(serde_json::json!(log))).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "audit log not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("get_audit_log: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
                .into_response()
        },
    }
}

/// GET /api/v1/audit-logs/export — CSV export
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn export_audit_logs(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(filters): Query<AuditLogFilters>,
) -> impl IntoResponse {
    let rows = sqlx::query_as::<_, AuditLog>(
        "SELECT id, user_id, username, action, resource_type, resource_id,
                ip_address, user_agent, details, status, created_at
         FROM identity.audit_logs
         WHERE ($1::uuid IS NULL OR user_id = $1)
           AND ($2::text IS NULL OR action = $2)
           AND ($3::timestamptz IS NULL OR created_at >= $3)
           AND ($4::timestamptz IS NULL OR created_at <= $4)
         ORDER BY created_at DESC
         LIMIT 10000",
    )
    .bind(filters.user_id)
    .bind(&filters.action)
    .bind(filters.start_date)
    .bind(filters.end_date)
    .fetch_all(&*state.pool)
    .await;

    match rows {
        Ok(logs) => {
            let mut csv = String::from("id,user_id,username,action,resource_type,resource_id,ip_address,status,created_at\n");
            for log in &logs {
                csv.push_str(&format!(
                    "{},{},{},{},{},{},{},{},{}\n",
                    log.id,
                    log.user_id.map(|u| u.to_string()).as_deref().unwrap_or(""),
                    log.username.as_deref().unwrap_or(""),
                    log.action,
                    log.resource_type.as_deref().unwrap_or(""),
                    log.resource_id.as_deref().unwrap_or(""),
                    log.ip_address.as_deref().unwrap_or(""),
                    log.status.as_deref().unwrap_or(""),
                    log.created_at.to_rfc3339(),
                ));
            }
            (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, "text/csv"),
                    (
                        header::CONTENT_DISPOSITION,
                        "attachment; filename=\"audit-logs.csv\"",
                    ),
                ],
                csv,
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("export_audit_logs: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
                .into_response()
        },
    }
}

/// POST /api/v1/audit — query endpoint (used by crosslinks.ts auditApi)
#[derive(Debug, Deserialize)]
/// Request body for AuditQuery.
pub struct AuditQueryRequest {
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub limit: Option<i64>,
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn query_audit(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(body): Json<AuditQueryRequest>,
) -> impl IntoResponse {
    let limit = body.limit.unwrap_or(50).clamp(1, 500);

    match sqlx::query_as::<_, AuditLog>(
        "SELECT id, user_id, username, action, resource_type, resource_id,
                ip_address, user_agent, details, status, created_at
         FROM identity.audit_logs
         WHERE ($1::text IS NULL OR resource_type = $1)
           AND ($2::text IS NULL OR resource_id = $2::text)
         ORDER BY created_at DESC
         LIMIT $3",
    )
    .bind(&body.entity_type)
    .bind(body.entity_id.map(|u| u.to_string()))
    .bind(limit)
    .fetch_all(&*state.pool)
    .await
    {
        Ok(logs) => (StatusCode::OK, Json(serde_json::json!(logs))).into_response(),
        Err(e) => {
            tracing::error!("query_audit: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
                .into_response()
        },
    }
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
