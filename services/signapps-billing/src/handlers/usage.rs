//! Usage statistics handler.

use axum::{extract::State, http::StatusCode, Json};
use serde::Serialize;

use crate::AppState;

/// Response payload for Usage operation.
#[derive(Debug, Serialize)]
pub struct UsageResponse {
    pub storage_used_bytes: i64,
    pub storage_limit_bytes: i64,
    pub api_calls_this_month: i64,
    pub api_calls_limit: i64,
    pub active_users: i64,
    pub user_limit: i64,
}

/// Return aggregated usage statistics.
pub async fn get_usage(
    State(state): State<AppState>,
) -> Result<Json<UsageResponse>, (StatusCode, String)> {
    // Query aggregated usage from billing metadata / plans
    let storage_row = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(SUM((metadata->>'storage_bytes')::bigint), 0) FROM billing.invoices WHERE status != 'draft'"
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let api_calls_row = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(SUM((metadata->>'api_calls')::bigint), 0) FROM billing.invoices \
         WHERE issued_at >= date_trunc('month', now())",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let active_users_row = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(DISTINCT tenant_id) FROM billing.invoices WHERE status = 'paid'",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    Ok(Json(UsageResponse {
        storage_used_bytes: storage_row,
        storage_limit_bytes: 107_374_182_400, // 100 GB default
        api_calls_this_month: api_calls_row,
        api_calls_limit: 1_000_000,
        active_users: active_users_row,
        user_limit: 100,
    }))
}
