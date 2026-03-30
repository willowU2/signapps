//! IF3: Adaptive DB pool visibility endpoint.
//!
//! GET /api/v1/metrics/pool-stats
//!
//! Returns current SQLx connection pool statistics so operators can see
//! whether the pool is under pressure (waiting connections) and tune
//! DB_MAX_CONNECTIONS accordingly.

use axum::{extract::State, Json};
use serde::Serialize;

use crate::AppState;
use signapps_common::Result;

/// Pool statistics response.
#[derive(Debug, Serialize)]
pub struct PoolStats {
    /// Total connections currently held (active + idle).
    pub size: u32,
    /// Idle connections ready to be acquired.
    pub idle: u32,
    /// Active connections currently executing a query.
    pub active: u32,
    /// Configured maximum pool size (from DB_MAX_CONNECTIONS env or default).
    pub max: u32,
    /// True when `size == max` and all connections are active —
    /// any new acquire will block until one is released.
    pub at_capacity: bool,
}

#[tracing::instrument(skip_all)]
pub async fn get_pool_stats(State(state): State<AppState>) -> Result<Json<PoolStats>> {
    let pool = &*state.pool;

    let size = pool.size();
    let idle = pool.num_idle() as u32;
    let active = size.saturating_sub(idle);

    // Read the configured max from env (same default as signapps-db create_pool).
    let max: u32 = std::env::var("DB_MAX_CONNECTIONS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(20);

    let at_capacity = size >= max && idle == 0;

    Ok(Json(PoolStats {
        size,
        idle,
        active,
        max,
        at_capacity,
    }))
}
