//! Shared maintenance-flag storage.
//!
//! Both the deploy server (which writes) and the proxy (which reads) use
//! this module so the maintenance page actually reaches end-users.
//!
//! Storage: the `maintenance_flags` table (migration 309). One row per env,
//! seeded at migration time. Reads are O(1) and cheap enough that the proxy
//! can call this on every request without caching — but callers are free to
//! wrap with a short TTL cache if profiles show it's hot.

use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::PgPool;

/// Check whether maintenance mode is active for the given env.
///
/// Reads the `maintenance_flags` row and honors `expires_at` (a non-null,
/// past timestamp is treated as disabled — a self-healing safety net).
///
/// # Errors
///
/// Returns an error on DB failure. The caller should fail closed (treat as
/// disabled) to avoid DoS-by-DB.
pub async fn is_enabled(pool: &PgPool, env: &str) -> Result<bool> {
    let row: Option<(bool, Option<DateTime<Utc>>)> =
        sqlx::query_as("SELECT enabled, expires_at FROM maintenance_flags WHERE env = $1")
            .bind(env)
            .fetch_optional(pool)
            .await?;
    match row {
        Some((true, Some(expiry))) => Ok(expiry > Utc::now()),
        Some((enabled, _)) => Ok(enabled),
        None => Ok(false),
    }
}

/// Enable maintenance for an env. `ttl_seconds` adds a self-healing expiry
/// (pass `None` for indefinite).
///
/// # Errors
///
/// Returns an error on DB failure.
pub async fn enable(pool: &PgPool, env: &str, ttl_seconds: Option<i64>) -> Result<()> {
    let expires_at = ttl_seconds.map(|s| Utc::now() + chrono::Duration::seconds(s));
    sqlx::query(
        "UPDATE maintenance_flags \
         SET enabled = true, set_at = now(), expires_at = $2 \
         WHERE env = $1",
    )
    .bind(env)
    .bind(expires_at)
    .execute(pool)
    .await?;
    tracing::warn!(%env, ?ttl_seconds, "maintenance flag ENABLED (DB-backed)");
    Ok(())
}

/// Disable maintenance for an env.
///
/// # Errors
///
/// Returns an error on DB failure.
pub async fn disable(pool: &PgPool, env: &str) -> Result<()> {
    sqlx::query(
        "UPDATE maintenance_flags \
         SET enabled = false, expires_at = NULL, set_at = now() \
         WHERE env = $1",
    )
    .bind(env)
    .execute(pool)
    .await?;
    tracing::info!(%env, "maintenance flag disabled (DB-backed)");
    Ok(())
}

#[cfg(test)]
mod tests {
    // Integration coverage is handled by the existing
    // signapps-deploy/tests/* suite which now hits the real DB.
}
