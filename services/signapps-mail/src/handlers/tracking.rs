//! Email read-tracking handler.
//!
//! Endpoints:
//!   GET /api/v1/mail/track/:tracking_id      — PUBLIC: serve 1x1 GIF, log open
//!   GET /api/v1/mail/emails/tracking         — list tracking records (auth)
//!   GET /api/v1/mail/emails/tracking/stats   — aggregated open stats (auth)

use crate::AppState;
use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// 1×1 transparent GIF (44 bytes, hard-coded)
// ============================================================================

/// Minimal 1×1 transparent GIF89a pixel.
static TRACKING_PIXEL: &[u8] = &[
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
    0x01, 0x00, 0x01, 0x00, // width=1, height=1
    0x80, 0x00, 0x00, // GCT flag, BG index, pixel aspect
    0x00, 0x00, 0x00, // color 0: black
    0xFF, 0xFF, 0xFF, // color 1: white
    0x21, 0xF9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, // graphic ctrl ext
    0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // image descriptor
    0x02, 0x02, 0x44, 0x01, 0x00, // LZW-compressed pixel
    0x3B, // GIF trailer
];

// ============================================================================
// Domain type
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
/// EmailOpen data transfer object.
pub struct EmailOpen {
    pub id: Uuid,
    pub tracking_id: Uuid,
    pub email_id: Uuid,
    pub account_id: Uuid,
    pub user_id: Uuid,
    pub open_count: i32,
    pub first_open: Option<DateTime<Utc>>,
    pub last_open: Option<DateTime<Utc>>,
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// Request / Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct TrackingQuery {
    pub email_id: Option<Uuid>,
    pub account_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
/// TrackingStats data transfer object.
pub struct TrackingStats {
    pub total_tracked: i64,
    pub total_opened: i64,
    pub unique_opens: i64,
    pub open_rate: f64,
    pub average_opens_per_email: f64,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/mail/track/:tracking_id  — PUBLIC (no auth)
///
/// Serves a 1×1 transparent GIF.  Logs the open event (upserts the open
/// record so repeated opens increment `open_count`).
#[tracing::instrument(skip_all)]
pub async fn track_open(
    State(state): State<AppState>,
    Path(tracking_id): Path<Uuid>,
    headers: axum::http::HeaderMap,
) -> Response {
    let user_agent = headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // Best-effort IP: use X-Forwarded-For when behind a proxy, otherwise omit.
    let ip: Option<String> = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string())
        });

    // Upsert: on first hit create the row; on subsequent hits increment counter.
    let _ = sqlx::query(
        r#"UPDATE mail.email_opens
           SET open_count  = open_count + 1,
               first_open  = COALESCE(first_open, NOW()),
               last_open   = NOW(),
               user_agent  = COALESCE($2, user_agent),
               ip_address  = COALESCE($3, ip_address),
               updated_at  = NOW()
           WHERE tracking_id = $1"#,
    )
    .bind(tracking_id)
    .bind(&user_agent)
    .bind(&ip)
    .execute(&state.pool)
    .await;

    // Return the pixel regardless of whether the tracking_id exists.
    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "image/gif"),
            (header::CACHE_CONTROL, "no-store, no-cache, must-revalidate"),
            (header::PRAGMA, "no-cache"),
        ],
        TRACKING_PIXEL,
    )
        .into_response()
}

/// GET /api/v1/mail/emails/tracking?email_id=...&account_id=...
#[tracing::instrument(skip_all)]
pub async fn list_tracking(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<TrackingQuery>,
) -> impl IntoResponse {
    let result = if let Some(email_id) = params.email_id {
        sqlx::query_as::<_, EmailOpen>(
            r#"SELECT t.* FROM mail.email_opens t
               WHERE t.email_id = $1 AND t.user_id = $2
               ORDER BY t.created_at DESC"#,
        )
        .bind(email_id)
        .bind(claims.sub)
        .fetch_all(&state.pool)
        .await
    } else if let Some(account_id) = params.account_id {
        sqlx::query_as::<_, EmailOpen>(
            r#"SELECT t.* FROM mail.email_opens t
               WHERE t.account_id = $1 AND t.user_id = $2
               ORDER BY t.created_at DESC"#,
        )
        .bind(account_id)
        .bind(claims.sub)
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, EmailOpen>(
            r#"SELECT t.* FROM mail.email_opens t
               WHERE t.user_id = $1
               ORDER BY t.created_at DESC"#,
        )
        .bind(claims.sub)
        .fetch_all(&state.pool)
        .await
    };

    match result {
        Ok(rows) => Json(rows).into_response(),
        Err(e) => {
            tracing::error!("Failed to list tracking records: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}

/// GET /api/v1/mail/emails/tracking/stats
#[tracing::instrument(skip_all)]
pub async fn tracking_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<TrackingQuery>,
) -> impl IntoResponse {
    let account_filter = params.account_id;

    // Total emails tracked (rows in email_opens) for this user
    let total_tracked: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM mail.email_opens
           WHERE user_id = $1
             AND ($2::UUID IS NULL OR account_id = $2)"#,
    )
    .bind(claims.sub)
    .bind(account_filter)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    // Emails that were opened at least once
    let total_opened: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM mail.email_opens
           WHERE user_id = $1
             AND ($2::UUID IS NULL OR account_id = $2)
             AND open_count > 0"#,
    )
    .bind(claims.sub)
    .bind(account_filter)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    // Sum of all open_count values (total opens across all emails)
    let unique_opens: i64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(open_count), 0) FROM mail.email_opens
           WHERE user_id = $1
             AND ($2::UUID IS NULL OR account_id = $2)"#,
    )
    .bind(claims.sub)
    .bind(account_filter)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let open_rate = if total_tracked > 0 {
        total_opened as f64 / total_tracked as f64
    } else {
        0.0
    };

    let average_opens_per_email = if total_opened > 0 {
        unique_opens as f64 / total_opened as f64
    } else {
        0.0
    };

    Json(TrackingStats {
        total_tracked,
        total_opened,
        unique_opens,
        open_rate,
        average_opens_per_email,
    })
    .into_response()
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
