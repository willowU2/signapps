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
use sqlx::PgPool;

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
