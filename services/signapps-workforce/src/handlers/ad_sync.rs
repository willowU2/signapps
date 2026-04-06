//! Handlers for AD sync queue management and monitoring.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{middleware::TenantContext, Claims};
use signapps_db::models::ad_sync::{AdDcSite, AdOu, AdSyncEvent, AdUserAccount};
use signapps_db::repositories::AdSyncQueueRepository;
// Reconciliation lives in the ad-core crate (also used by signapps-dc)
use signapps_ad_core;

/// Get sync queue statistics for a domain.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn sync_queue_stats(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let stats = AdSyncQueueRepository::stats(&state.pool, domain_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get queue stats: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(stats))
}

/// List recent sync events for a domain (last 100, newest first).
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_sync_events(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let events: Vec<AdSyncEvent> = sqlx::query_as(
        "SELECT * FROM ad_sync_queue WHERE domain_id = $1 ORDER BY created_at DESC LIMIT 100",
    )
    .bind(domain_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list sync events: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(events)))
}

/// List AD OUs for a domain, ordered by distinguished name.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_ad_ous(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let ous: Vec<AdOu> = sqlx::query_as(
        "SELECT * FROM ad_ous WHERE domain_id = $1 ORDER BY distinguished_name",
    )
    .bind(domain_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list OUs: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(ous)))
}

/// List AD user accounts for a domain, ordered by display name.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_ad_users(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let users: Vec<AdUserAccount> = sqlx::query_as(
        "SELECT * FROM ad_user_accounts WHERE domain_id = $1 ORDER BY display_name",
    )
    .bind(domain_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list AD users: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(users)))
}

/// Set or replace the mail domain assignment for an org node.
///
/// Body: `{ "domain_id": "<uuid>" }`
///
/// # Errors
///
/// Returns `StatusCode::BAD_REQUEST` if `domain_id` is missing or invalid.
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the upsert fails.
#[tracing::instrument(skip_all)]
pub async fn set_node_mail_domain(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(node_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, StatusCode> {
    let domain_id: Uuid = serde_json::from_value(body["domain_id"].clone())
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    sqlx::query(
        "INSERT INTO ad_node_mail_domains (node_id, domain_id) VALUES ($1, $2) \
         ON CONFLICT (node_id) DO UPDATE SET domain_id = $2",
    )
    .bind(node_id)
    .bind(domain_id)
    .execute(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to set node mail domain: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(StatusCode::NO_CONTENT)
}

/// Remove the mail domain assignment from an org node.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the delete fails.
#[tracing::instrument(skip_all)]
pub async fn remove_node_mail_domain(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(node_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    sqlx::query("DELETE FROM ad_node_mail_domains WHERE node_id = $1")
        .bind(node_id)
        .execute(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to remove node mail domain: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT)
}

/// Trigger a manual AD reconciliation pass immediately.
///
/// Runs the same logic as the 15-minute cron in `signapps-dc`.
/// Returns a [`ReconciliationReport`] with drift counters.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if reconciliation fails.
#[tracing::instrument(skip_all)]
pub async fn trigger_reconciliation(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    match signapps_ad_core::reconciliation::reconcile(&state.pool).await {
        Ok(report) => Ok(Json(json!(report))),
        Err(e) => {
            tracing::error!("Manual reconciliation failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// List DC sites (domain controllers) for a domain.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_dc_sites(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let dcs: Vec<AdDcSite> = sqlx::query_as(
        "SELECT * FROM ad_dc_sites WHERE domain_id = $1 ORDER BY dc_hostname",
    )
    .bind(domain_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list DC sites: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(dcs)))
}
