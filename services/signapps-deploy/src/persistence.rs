//! Persistence layer for deployment records.
//!
//! Writes to the `deployments` and `deployment_audit_log` tables created in
//! migration 305. All timestamps use `now()` on the database side for
//! consistency.

use anyhow::Result;
use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

/// In-memory representation of a deployment row, returned after
/// [`insert_pending`] so the orchestrator can reference the row's id
/// and decide whether a rollback is possible.
#[derive(Debug, Clone)]
pub struct Deployment {
    pub id: Uuid,
    pub env: String,
    pub version: String,
    pub git_sha: String,
    pub previous_version: Option<String>,
}

/// Insert a `pending` deployment. Also looks up the last successful
/// deployment on the same env to populate `previous_version`, which enables
/// a future rollback.
pub async fn insert_pending(
    pool: &PgPool,
    env: &str,
    version: &str,
    git_sha: &str,
) -> Result<Deployment> {
    let id = Uuid::new_v4();

    let previous_version: Option<String> = sqlx::query_scalar(
        "SELECT version FROM deployments
         WHERE env = $1 AND status = 'success'
         ORDER BY completed_at DESC LIMIT 1",
    )
    .bind(env)
    .fetch_optional(pool)
    .await?;

    sqlx::query(
        "INSERT INTO deployments \
         (id, env, version, git_sha, status, previous_version, triggered_at) \
         VALUES ($1, $2, $3, $4, 'pending', $5, now())",
    )
    .bind(id)
    .bind(env)
    .bind(version)
    .bind(git_sha)
    .bind(&previous_version)
    .execute(pool)
    .await?;

    Ok(Deployment {
        id,
        env: env.to_string(),
        version: version.to_string(),
        git_sha: git_sha.to_string(),
        previous_version,
    })
}

/// Mark a deployment as running and record `started_at`.
pub async fn mark_running(pool: &PgPool, id: Uuid) -> Result<()> {
    sqlx::query("UPDATE deployments SET status = 'running', started_at = now() WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Mark a deployment as successful, record duration + applied migrations.
pub async fn mark_success(pool: &PgPool, id: Uuid, migrations: &[String]) -> Result<()> {
    sqlx::query(
        "UPDATE deployments SET
           status = 'success',
           completed_at = now(),
           migrations_applied = $2,
           duration_seconds = EXTRACT(EPOCH FROM (now() - started_at))::int
         WHERE id = $1",
    )
    .bind(id)
    .bind(migrations)
    .execute(pool)
    .await?;
    Ok(())
}

/// Mark a deployment as failed with an error message.
pub async fn mark_failed(pool: &PgPool, id: Uuid, error: &str) -> Result<()> {
    sqlx::query(
        "UPDATE deployments SET
           status = 'failed',
           completed_at = now(),
           error_message = $2,
           duration_seconds = EXTRACT(EPOCH FROM (now() - started_at))::int
         WHERE id = $1",
    )
    .bind(id)
    .bind(error)
    .execute(pool)
    .await?;
    Ok(())
}

/// Mark a deployment as rolled back (after a failed deploy auto-reverted
/// to the previous version).
pub async fn mark_rolled_back(pool: &PgPool, id: Uuid) -> Result<()> {
    sqlx::query("UPDATE deployments SET status = 'rolled_back' WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Append an entry to the audit log.
pub async fn audit(pool: &PgPool, deployment_id: Uuid, action: &str, payload: Value) -> Result<()> {
    sqlx::query(
        "INSERT INTO deployment_audit_log (deployment_id, action, payload) \
         VALUES ($1, $2, $3)",
    )
    .bind(deployment_id)
    .bind(action)
    .bind(payload)
    .execute(pool)
    .await?;
    Ok(())
}

/// Fetch the last successful deployment of the given environment.
/// Returns `None` if no successful deploy has ever completed.
pub async fn last_successful(pool: &PgPool, env: &str) -> Result<Option<(String, DateTime<Utc>)>> {
    let row: Option<(String, DateTime<Utc>)> = sqlx::query_as(
        "SELECT version, completed_at FROM deployments
         WHERE env = $1 AND status = 'success'
         ORDER BY completed_at DESC LIMIT 1",
    )
    .bind(env)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}
