//! Promote the last successful dev deployment to prod.
//!
//! Flow:
//! 1. Fetch the latest successful dev deployment via [`persistence::last_successful`]
//! 2. Ensure the staging stack is healthy via [`docker::DockerClient::health_by_project`]
//! 3. Invoke [`orchestrator::deploy`] on env=prod with that same version
//!
//! The orchestrator holds the global advisory lock, so this function is
//! transparent to concurrent deploys (it returns their error).

use crate::{docker::DockerClient, orchestrator, persistence};
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

async fn connect_pool() -> Result<PgPool> {
    let url = std::env::var("DATABASE_URL").context("DATABASE_URL not set")?;
    Ok(PgPool::connect(&url).await?)
}

/// Promote the last successful dev deployment to prod.
///
/// # Errors
///
/// Returns an error if:
/// - `DATABASE_URL` is not set or the pool cannot connect
/// - No successful dev deployment exists in the persistence layer
/// - The staging Docker stack is empty or not fully healthy
/// - The underlying `orchestrator::deploy` call fails
pub async fn promote_dev_to_prod() -> Result<()> {
    let pool = connect_pool().await?;

    let (dev_version, deployed_at) = persistence::last_successful(&pool, "dev")
        .await?
        .ok_or_else(|| {
            anyhow::anyhow!(
                "no successful dev deployment to promote — run \
                 `just deploy-dev <version>` first"
            )
        })?;

    tracing::info!(%dev_version, %deployed_at, "promoting dev to prod");

    let docker = DockerClient::connect()?;
    let health = docker.health_by_project("signapps-staging").await?;
    let total = health.len();
    let healthy = health.values().filter(|h| **h).count();

    if total == 0 {
        anyhow::bail!(
            "dev stack has no containers — is docker-compose.staging.yml up? \
             Run `just staging-up`."
        );
    }
    if healthy < total {
        anyhow::bail!(
            "dev is not fully healthy ({healthy}/{total}) — refusing to \
             promote an unreliable state"
        );
    }

    tracing::info!(
        %dev_version,
        healthy_containers = healthy,
        "dev healthy; invoking production deploy with same version"
    );

    orchestrator::deploy("prod", &dev_version).await
}

/// Insert a new row in `scheduled_maintenance` for the given env/time/duration.
///
/// # Errors
///
/// Returns an error if the DB pool cannot connect or if the INSERT fails.
pub async fn schedule_maintenance(
    env: &str,
    at: DateTime<Utc>,
    duration_minutes: i32,
    message: &str,
) -> anyhow::Result<()> {
    let pool = connect_pool().await?;
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO scheduled_maintenance (id, env, scheduled_at, duration_minutes, message, status) \
         VALUES ($1, $2, $3, $4, $5, 'scheduled')",
    )
    .bind(id)
    .bind(env)
    .bind(at)
    .bind(duration_minutes)
    .bind(message)
    .execute(&pool)
    .await?;
    // CLI output — intentional stdout.
    #[allow(clippy::print_stdout)]
    {
        println!("Scheduled maintenance window {id} for {env} at {at} ({duration_minutes}m)");
    }
    Ok(())
}

/// List upcoming (scheduled or active) maintenance windows for the given env.
///
/// # Errors
///
/// Returns an error if the DB pool cannot connect or if the SELECT fails.
pub async fn list_maintenance(env: &str) -> anyhow::Result<()> {
    let pool = connect_pool().await?;
    let rows: Vec<(Uuid, DateTime<Utc>, i32, String, String)> = sqlx::query_as(
        "SELECT id, scheduled_at, duration_minutes, status, message \
         FROM scheduled_maintenance \
         WHERE env = $1 AND status IN ('scheduled', 'active') \
         ORDER BY scheduled_at",
    )
    .bind(env)
    .fetch_all(&pool)
    .await?;

    #[allow(clippy::print_stdout)]
    {
        if rows.is_empty() {
            println!("No scheduled maintenance for {env}");
            return Ok(());
        }
        for (id, at, dur, status, message) in rows {
            println!("{id} | {at} | {dur}m | {status} | {message}");
        }
    }
    Ok(())
}
