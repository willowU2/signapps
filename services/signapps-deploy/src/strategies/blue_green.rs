//! Blue/Green deployment strategy.
//!
//! Flow:
//! 1. Read `active_stack` for env → `active_color`.
//! 2. `target_color` = `active_color.other()`.
//! 3. `docker pull` + `docker compose up -d` on the TARGET host.
//! 4. Wait healthy on target (5 min timeout).
//! 5. Swap `active_stack` in DB → proxy picks up on the next request.
//!
//! Rollback: swap the DB row back. The old stack is still up (we don't tear
//! it down in this strategy), so rollback is effectively instantaneous.

use super::DeploymentStrategy;
use crate::docker::host::DockerHost;
use anyhow::{Context, Result};
use async_trait::async_trait;
use signapps_common::active_stack::{self, Color};
use sqlx::PgPool;
use std::sync::Arc;

/// Configuration for a Blue/Green strategy instance.
pub struct BlueGreenStrategy {
    pub pool: PgPool,
    /// Host serving as the "blue" stack — label only, either color can be active at any time.
    pub blue_host: Arc<dyn DockerHost>,
    /// Host serving as the "green" stack.
    pub green_host: Arc<dyn DockerHost>,
    /// Compose file path on both hosts (must match).
    pub compose_file: String,
    /// Env file path on both hosts.
    pub env_file: String,
    /// Base image repo (e.g. `ghcr.io/myorg/signapps-platform`).
    pub image_repo: String,
    /// Compose project label to filter health by (e.g. `signapps-prod`).
    pub compose_project: String,
}

impl BlueGreenStrategy {
    fn host_for(&self, color: Color) -> &Arc<dyn DockerHost> {
        match color {
            Color::Blue => &self.blue_host,
            Color::Green => &self.green_host,
        }
    }
}

#[async_trait]
impl DeploymentStrategy for BlueGreenStrategy {
    async fn deploy(&self, env: &str, version: &str) -> Result<()> {
        let active = active_stack::get_active(&self.pool, env).await?;
        let target = active.other();
        let target_host = self.host_for(target).clone();
        let image_ref = format!("{}:{version}", self.image_repo);

        tracing::info!(
            %env,
            active = %active.as_str(),
            target = %target.as_str(),
            %version,
            target_host = %target_host.host_label(),
            "BG deploy starting",
        );

        target_host
            .pull_image(&image_ref)
            .await
            .context("pull image on target")?;
        target_host
            .compose_up(
                &self.compose_file,
                &self.env_file,
                ("SIGNAPPS_VERSION", version),
            )
            .await
            .context("compose up on target")?;

        wait_healthy(&*target_host, &self.compose_project)
            .await
            .context("wait healthy on target")?;

        active_stack::swap(&self.pool, env, None).await?;

        tracing::info!(
            %env,
            new_active = %target.as_str(),
            "BG swap done — target is now active",
        );
        Ok(())
    }

    async fn rollback(&self, env: &str) -> Result<()> {
        // Swap the DB row back. The old stack stays up, so this is effectively
        // instantaneous.
        active_stack::swap(&self.pool, env, None).await?;
        Ok(())
    }

    fn name(&self) -> &'static str {
        "blue_green"
    }
}

async fn wait_healthy(host: &dyn DockerHost, project: &str) -> Result<()> {
    use std::time::Duration;
    use tokio::time::{sleep, timeout};

    const HEALTHCHECK_TIMEOUT: Duration = Duration::from_secs(300);
    const HEALTHCHECK_POLL: Duration = Duration::from_secs(2);

    timeout(HEALTHCHECK_TIMEOUT, async {
        loop {
            let health = host.health_by_project(project).await?;
            if !health.is_empty() && health.values().all(|h| *h) {
                return Ok::<(), anyhow::Error>(());
            }
            sleep(HEALTHCHECK_POLL).await;
        }
    })
    .await
    .context("healthcheck timeout")?
}
