//! Toggle the maintenance flag via the shared DB-backed storage.
//!
//! Previously this module wrote to an in-process cache which did NOT reach the
//! proxy. Since P3c.3, reads and writes go through
//! `signapps_common::maintenance_flag` (backed by the `maintenance_flags`
//! table), so the deploy server's writes are visible to the proxy immediately.

use anyhow::Result;
use signapps_common::maintenance_flag;
use sqlx::PgPool;

const MAINTENANCE_TTL_SECONDS: i64 = 30 * 60;

/// Enable maintenance mode for the given env. Idempotent.
///
/// # Errors
///
/// Returns an error if the DB write fails.
pub async fn enable(pool: &PgPool, env: &str) -> Result<()> {
    maintenance_flag::enable(pool, env, Some(MAINTENANCE_TTL_SECONDS)).await
}

/// Disable maintenance mode for the given env. Idempotent.
///
/// # Errors
///
/// Returns an error if the DB write fails.
pub async fn disable(pool: &PgPool, env: &str) -> Result<()> {
    maintenance_flag::disable(pool, env).await
}

/// Check whether maintenance mode is currently enabled for the given env.
pub async fn is_enabled(pool: &PgPool, env: &str) -> bool {
    maintenance_flag::is_enabled(pool, env)
        .await
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    // Integration tests cover this module via tests/scheduled_maintenance_e2e.rs.
    // Unit tests are omitted because every function wraps a DB call.
}
