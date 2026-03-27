//! API Quota handlers — IDEA-101
//!
//! GET /api/v1/metrics/api-quota          — system-wide per-user API usage
//! GET /api/v1/metrics/api-quota/:user_id — single user stats

use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use uuid::Uuid;

use crate::AppState;

// Internal row type for runtime sqlx query_as (skips compile-time table validation)
#[derive(sqlx::FromRow)]
struct ApiUsageRow {
    user_id: Uuid,
    email: String,
    daily_limit: Option<i64>,
    per_minute_limit: Option<i64>,
    calls_today: Option<i64>,
    calls_last_minute: Option<i64>,
    last_call_at: Option<DateTime<Utc>>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ApiQuotaEntry {
    pub user_id: Uuid,
    pub email: String,
    /// Total calls in the current rolling 24-hour window.
    pub calls_today: i64,
    /// Configured daily limit (0 = unlimited).
    pub daily_limit: i64,
    /// Remaining calls before the limit is hit (None when unlimited).
    pub remaining: Option<i64>,
    /// Calls in the current rolling minute (for rate-limit display).
    pub calls_last_minute: i64,
    /// Per-minute cap (0 = unlimited).
    pub per_minute_limit: i64,
    /// Timestamp of the last API call.
    pub last_call_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct QuotaListQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

/// GET /api/v1/metrics/api-quota
///
/// Returns per-user API quota usage for the last 24 hours, ordered by usage
/// descending.  Uses `platform.api_usage` if available, otherwise returns
/// an empty list (table may not be present in all deployments).
pub async fn list_api_quotas(
    State(state): State<AppState>,
    Query(q): Query<QuotaListQuery>,
) -> Result<Json<Vec<ApiQuotaEntry>>> {
    let pool = state.pool.inner();
    let limit = q.limit.unwrap_or(50).min(200);
    let offset = q.offset.unwrap_or(0);
    let now = Utc::now();
    let day_ago = now - chrono::Duration::hours(24);
    let minute_ago = now - chrono::Duration::minutes(1);

    // Attempt to query from platform.api_usage; gracefully return empty on error.
    // Use runtime query_as (not macro) to skip compile-time table validation —
    // platform.api_usage may not be present in all deployments.
    let rows: std::result::Result<Vec<ApiUsageRow>, sqlx::Error> = sqlx::query_as(
        r#"
        SELECT
            u.id AS user_id,
            u.email,
            COALESCE(quota.daily_limit,   0) AS daily_limit,
            COALESCE(quota.per_min_limit, 0) AS per_minute_limit,
            COUNT(CASE WHEN a.called_at >= $1 THEN 1 END) AS calls_today,
            COUNT(CASE WHEN a.called_at >= $2 THEN 1 END) AS calls_last_minute,
            MAX(a.called_at) AS last_call_at
        FROM identity.users u
        LEFT JOIN platform.api_usage a ON a.user_id = u.id
        LEFT JOIN platform.api_quotas quota ON quota.user_id = u.id
        GROUP BY u.id, u.email, quota.daily_limit, quota.per_min_limit
        ORDER BY calls_today DESC NULLS LAST
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(day_ago)
    .bind(minute_ago)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await;

    let rows: Vec<ApiUsageRow> = match rows {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("api_quota list failed (table may not exist): {}", e);
            return Ok(Json(vec![]));
        },
    };

    let entries: Vec<ApiQuotaEntry> = rows
        .into_iter()
        .map(|r| {
            let calls_today = r.calls_today.unwrap_or(0);
            let daily_limit = r.daily_limit.unwrap_or(0);
            let remaining = if daily_limit > 0 {
                Some((daily_limit - calls_today).max(0))
            } else {
                None
            };
            ApiQuotaEntry {
                user_id: r.user_id,
                email: r.email,
                calls_today,
                daily_limit,
                remaining,
                calls_last_minute: r.calls_last_minute.unwrap_or(0),
                per_minute_limit: r.per_minute_limit.unwrap_or(0),
                last_call_at: r.last_call_at.map(|t: DateTime<Utc>| t.to_rfc3339()),
            }
        })
        .collect();

    Ok(Json(entries))
}

/// GET /api/v1/metrics/api-quota/:user_id
///
/// Returns API quota stats for a single user.
pub async fn get_user_api_quota(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<ApiQuotaEntry>> {
    let pool = state.pool.inner();
    let now = Utc::now();
    let day_ago = now - chrono::Duration::hours(24);
    let minute_ago = now - chrono::Duration::minutes(1);

    // Use runtime query_as (not macro) to skip compile-time table validation.
    let row: ApiUsageRow = sqlx::query_as(
        r#"
        SELECT
            u.id AS user_id,
            u.email,
            COALESCE(quota.daily_limit,   0) AS daily_limit,
            COALESCE(quota.per_min_limit, 0) AS per_minute_limit,
            COUNT(CASE WHEN a.called_at >= $2 THEN 1 END) AS calls_today,
            COUNT(CASE WHEN a.called_at >= $3 THEN 1 END) AS calls_last_minute,
            MAX(a.called_at) AS last_call_at
        FROM identity.users u
        LEFT JOIN platform.api_usage a ON a.user_id = u.id
        LEFT JOIN platform.api_quotas quota ON quota.user_id = u.id
        WHERE u.id = $1
        GROUP BY u.id, u.email, quota.daily_limit, quota.per_min_limit
        "#,
    )
    .bind(user_id)
    .bind(day_ago)
    .bind(minute_ago)
    .fetch_optional(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .ok_or_else(|| Error::NotFound("User not found".to_string()))?;

    let calls_today = row.calls_today.unwrap_or(0);
    let daily_limit = row.daily_limit.unwrap_or(0);
    let remaining = if daily_limit > 0 {
        Some((daily_limit - calls_today).max(0))
    } else {
        None
    };

    Ok(Json(ApiQuotaEntry {
        user_id: row.user_id,
        email: row.email,
        calls_today,
        daily_limit,
        remaining,
        calls_last_minute: row.calls_last_minute.unwrap_or(0),
        per_minute_limit: row.per_minute_limit.unwrap_or(0),
        last_call_at: row.last_call_at.map(|t: DateTime<Utc>| t.to_rfc3339()),
    }))
}
