//! Provisioning admin handlers for `/api/v1/org/provisioning` (S1 W5).
//!
//! Backs the Task 34 admin dashboard with three endpoints:
//! - `GET /pending`           — rows whose status is neither `succeeded`.
//! - `POST /:id/retry`        — re-emit the source event so the
//!   matching consumer retries its fan-out.
//! - Additional listing endpoints are provided for the AD sync
//!   activity panel (`/api/v1/org/ad/sync-log`).

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use signapps_common::pg_events::NewEvent;
use signapps_common::{Error, Result};
use signapps_db::models::org::{AdSyncLog, ProvisioningLog};
use uuid::Uuid;

use crate::AppState;

// ============================================================================
// Router
// ============================================================================

/// Build the provisioning admin router nested at
/// `/api/v1/org/provisioning`.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/pending", get(pending))
        .route("/:id/retry", post(retry))
}

/// Build the AD-sync-log read-only router nested at
/// `/api/v1/org/ad/sync-log`. Wired from `lib.rs` alongside the
/// existing AD routes.
pub fn ad_sync_log_routes() -> Router<AppState> {
    Router::new().route("/", get(ad_sync_log_list))
}

// ============================================================================
// Request / response DTOs
// ============================================================================

/// Query for the pending provisioning list.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct PendingQuery {
    /// Optional tenant filter.
    pub tenant_id: Option<Uuid>,
    /// Max rows to return; default 50, capped at 200.
    pub limit: Option<i64>,
}

/// Query for the AD sync log list.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct AdSyncLogQuery {
    /// Optional tenant filter.
    pub tenant_id: Option<Uuid>,
    /// Max rows to return; default 50, capped at 200.
    pub limit: Option<i64>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/org/provisioning/pending — list recent rows that failed
/// or are still pending a retry.
#[utoipa::path(
    get,
    path = "/api/v1/org/provisioning/pending",
    tag = "Org",
    params(PendingQuery),
    responses(
        (status = 200, description = "Provisioning rows awaiting retry", body = Vec<ProvisioningLog>),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn pending(
    State(st): State<AppState>,
    Query(q): Query<PendingQuery>,
) -> Result<Json<Vec<ProvisioningLog>>> {
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let rows = match q.tenant_id {
        Some(tid) => sqlx::query_as::<_, ProvisioningLog>(
            "SELECT * FROM org_provisioning_log
              WHERE tenant_id = $1
                AND status <> 'succeeded'
              ORDER BY created_at DESC
              LIMIT $2",
        )
        .bind(tid)
        .bind(limit)
        .fetch_all(st.pool.inner())
        .await,
        None => sqlx::query_as::<_, ProvisioningLog>(
            "SELECT * FROM org_provisioning_log
              WHERE status <> 'succeeded'
              ORDER BY created_at DESC
              LIMIT $1",
        )
        .bind(limit)
        .fetch_all(st.pool.inner())
        .await,
    }
    .map_err(|e| Error::Database(format!("list pending provisioning: {e}")))?;
    Ok(Json(rows))
}

/// POST /api/v1/org/provisioning/:id/retry — republish the source
/// event so the corresponding consumer retries its fan-out.
///
/// We re-emit `org.user.created` / `org.user.deactivated` payloads as
/// minimal JSON because the original person row may have since
/// changed. Each service will re-check DB state before writing.
#[utoipa::path(
    post,
    path = "/api/v1/org/provisioning/{id}/retry",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Provisioning log row UUID")),
    responses(
        (status = 202, description = "Retry event scheduled"),
        (status = 404, description = "Provisioning row not found"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn retry(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    let row = sqlx::query_as::<_, ProvisioningLog>(
        "SELECT * FROM org_provisioning_log WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(st.pool.inner())
    .await
    .map_err(|e| Error::Database(format!("get provisioning: {e}")))?
    .ok_or_else(|| Error::NotFound(format!("provisioning {id}")))?;

    // Bump attempts so the UI shows progress even if the retry fails.
    sqlx::query("UPDATE org_provisioning_log SET attempts = attempts + 1, status = 'pending_retry', updated_at = now() WHERE id = $1")
        .bind(id)
        .execute(st.pool.inner())
        .await
        .map_err(|e| Error::Database(format!("bump attempts: {e}")))?;

    // Re-emit the source event. We pass the minimal shape that the
    // provisioning consumer knows how to parse — the consumer will
    // re-hydrate Person from the DB if needed.
    let payload = serde_json::json!({
        "person_id": row.person_id,
        "tenant_id": row.tenant_id,
        "retry_of": row.id,
    });
    let _ = st
        .event_bus
        .publish(NewEvent {
            event_type: row.topic.clone(),
            aggregate_id: Some(row.person_id),
            payload,
        })
        .await;

    tracing::info!(provisioning_id=%id, topic=%row.topic, "provisioning retry scheduled");
    Ok(StatusCode::ACCEPTED)
}

/// GET /api/v1/org/ad/sync-log — last 50 AD sync log entries.
#[utoipa::path(
    get,
    path = "/api/v1/org/ad/sync-log",
    tag = "Org",
    params(AdSyncLogQuery),
    responses(
        (status = 200, description = "Recent AD sync log entries", body = Vec<AdSyncLog>),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn ad_sync_log_list(
    State(st): State<AppState>,
    Query(q): Query<AdSyncLogQuery>,
) -> Result<Json<Vec<AdSyncLog>>> {
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let rows = match q.tenant_id {
        Some(tid) => sqlx::query_as::<_, AdSyncLog>(
            "SELECT * FROM org_ad_sync_log
              WHERE tenant_id = $1
              ORDER BY created_at DESC
              LIMIT $2",
        )
        .bind(tid)
        .bind(limit)
        .fetch_all(st.pool.inner())
        .await,
        None => sqlx::query_as::<_, AdSyncLog>(
            "SELECT * FROM org_ad_sync_log ORDER BY created_at DESC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(st.pool.inner())
        .await,
    }
    .map_err(|e| Error::Database(format!("list ad sync log: {e}")))?;
    Ok(Json(rows))
}
