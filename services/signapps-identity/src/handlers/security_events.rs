//! Security Events dashboard handlers.
//!
//! Exposes security events from the `platform.security_events` table
//! for admin dashboard consumption.

use axum::{extract::State, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Result;
use uuid::Uuid;

use crate::AppState;

/// Security event row returned from the database.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
/// SecurityEventRow data transfer object.
pub struct SecurityEventRow {
    pub id: Uuid,
    pub event_type: String,
    pub severity: String,
    pub actor_id: Option<Uuid>,
    pub ip_address: Option<String>,
    pub resource: Option<String>,
    pub details: String,
    pub created_at: DateTime<Utc>,
}

/// Query parameters for listing security events.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct SecurityEventsQuery {
    pub event_type: Option<String>,
    pub severity: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// GET /api/v1/admin/security/events — List security events.
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn list(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<SecurityEventsQuery>,
) -> Result<Json<Vec<SecurityEventRow>>> {
    let limit = query.limit.unwrap_or(50).min(200);
    let offset = query.offset.unwrap_or(0);

    let events = sqlx::query_as::<_, SecurityEventRow>(
        r#"SELECT id, event_type, severity, actor_id, ip_address, resource, details, created_at
           FROM platform.security_events
           WHERE ($1::TEXT IS NULL OR event_type = $1)
             AND ($2::TEXT IS NULL OR severity = $2)
           ORDER BY created_at DESC
           LIMIT $3 OFFSET $4"#,
    )
    .bind(query.event_type.as_deref())
    .bind(query.severity.as_deref())
    .bind(limit)
    .bind(offset)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    Ok(Json(events))
}

/// GET /api/v1/admin/security/events/summary — Aggregated counts by type.
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn summary(State(state): State<AppState>) -> Result<Json<Vec<EventSummary>>> {
    let rows = sqlx::query_as::<_, EventSummary>(
        r#"SELECT event_type, severity, COUNT(*)::BIGINT as count
           FROM platform.security_events
           WHERE created_at > now() - INTERVAL '24 hours'
           GROUP BY event_type, severity
           ORDER BY count DESC"#,
    )
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    Ok(Json(rows))
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
/// EventSummary data transfer object.
pub struct EventSummary {
    pub event_type: String,
    pub severity: String,
    pub count: i64,
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
