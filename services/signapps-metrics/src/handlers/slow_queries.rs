//! IF2: Slow query monitoring endpoint.
//!
//! GET /api/v1/metrics/slow-queries
//!
//! Queries pg_stat_activity for long-running queries (> 1 second by default).
//! Falls back gracefully if the view is unavailable.

use axum::{extract::State, Json};
use serde::Serialize;
use sqlx::Row;

use crate::AppState;
use signapps_common::Result;

/// A single slow query record.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// SlowQuery data transfer object.
pub struct SlowQuery {
    /// Backend PID.
    pub pid: i32,
    /// Database name.
    pub datname: Option<String>,
    /// Username.
    pub usename: Option<String>,
    /// Application name.
    pub application_name: Option<String>,
    /// Current state (active, idle, idle in transaction, …).
    pub state: Option<String>,
    /// Duration the query has been running (seconds).
    pub duration_seconds: f64,
    /// Truncated query text (first 500 chars).
    pub query: Option<String>,
    /// ISO-8601 query start time.
    pub query_start: Option<String>,
}

/// Response envelope.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// SlowQueriesResponse data transfer object.
pub struct SlowQueriesResponse {
    pub queries: Vec<SlowQuery>,
    /// Minimum duration threshold used for filtering (seconds).
    pub threshold_seconds: f64,
    /// Whether pg_stat_statements extension is available.
    pub pg_stat_statements_available: bool,
}

/// Threshold in seconds — queries running longer than this are considered slow.
const SLOW_THRESHOLD_SECS: f64 = 1.0;

/// Return the top-10 currently running queries sorted by duration descending.
#[utoipa::path(
    get,
    path = "/api/v1/system/slow-queries",
    responses(
        (status = 200, description = "Slow queries from pg_stat_activity", body = SlowQueriesResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Metrics"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_slow_queries(State(state): State<AppState>) -> Result<Json<SlowQueriesResponse>> {
    // First, try to check if pg_stat_statements is available (informational).
    let pg_stat_statements_available = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        )",
    )
    .fetch_one(&*state.pool)
    .await
    .unwrap_or(false);

    // Query pg_stat_activity for active queries running longer than threshold.
    // Use runtime query to avoid sqlx macro issues with NUMERIC/EXTRACT types.
    let sql = "
        SELECT
            pid::int4,
            datname,
            usename,
            application_name,
            state,
            EXTRACT(EPOCH FROM (clock_timestamp() - query_start))::float8 AS duration_seconds,
            LEFT(query, 500) AS query,
            query_start::text AS query_start_str
        FROM pg_stat_activity
        WHERE state = 'active'
          AND query NOT ILIKE '%pg_stat_activity%'
          AND query_start IS NOT NULL
          AND EXTRACT(EPOCH FROM (clock_timestamp() - query_start)) > $1::float8
        ORDER BY duration_seconds DESC NULLS LAST
        LIMIT 10
    ";

    let queries = match sqlx::query(sql)
        .bind(SLOW_THRESHOLD_SECS)
        .fetch_all(&*state.pool)
        .await
    {
        Ok(rows) => rows
            .into_iter()
            .map(|r| SlowQuery {
                pid: r.get::<i32, _>("pid"),
                datname: r.get("datname"),
                usename: r.get("usename"),
                application_name: r.get("application_name"),
                state: r.get("state"),
                duration_seconds: r.get::<f64, _>("duration_seconds"),
                query: r.get("query"),
                query_start: r.get("query_start_str"),
            })
            .collect(),
        Err(e) => {
            tracing::warn!("Failed to query pg_stat_activity: {}", e);
            vec![]
        },
    };

    Ok(Json(SlowQueriesResponse {
        queries,
        threshold_seconds: SLOW_THRESHOLD_SECS,
        pg_stat_statements_available,
    }))
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
