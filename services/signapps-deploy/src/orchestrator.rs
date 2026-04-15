//! Deployment state machine.
//!
//! States: `pending` → `running` → `success` | `failed` (→ `rolled_back`).
//!
//! ## Phase 1 POC limitation
//!
//! The maintenance flag is written to this process's local cache. For the
//! flag to reach the proxy, a future task must replace `CacheService` with a
//! shared backend (Redis, DB, or a small HTTP call to the proxy). Until then,
//! the maintenance toggle is effectively a no-op against the real proxy —
//! the CLI itself still runs the full deploy flow correctly, but end-users
//! won't see the maintenance page during a deploy.

use crate::{docker::DockerClient, maintenance, migrate, persistence};
use anyhow::{Context, Result};
use serde_json::json;
use signapps_cache::CacheService;
use sqlx::PgPool;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::{sleep, timeout};

const HEALTHCHECK_TIMEOUT: Duration = Duration::from_secs(300);
const HEALTHCHECK_POLL: Duration = Duration::from_secs(2);
const COMPOSE_PROJECT: &str = "signapps-prod";
const IMAGE_REPO: &str = "ghcr.io/your-org/signapps-platform";

/// Build the path to the repo's `migrations/` directory from the binary's CWD.
fn migrations_dir() -> PathBuf {
    PathBuf::from("migrations")
}

async fn connect_pool() -> Result<PgPool> {
    let url = std::env::var("DATABASE_URL").context("DATABASE_URL not set")?;
    Ok(PgPool::connect(&url).await?)
}

fn make_cache() -> Arc<CacheService> {
    Arc::new(CacheService::default_config())
}

/// Entry point: deploy a version to an environment.
pub async fn deploy(env: &str, version: &str) -> Result<()> {
    let pool = connect_pool().await?;
    let cache = make_cache();
    let docker = DockerClient::connect()?;

    let git_sha = std::env::var("GIT_SHA").unwrap_or_else(|_| "unknown".to_string());
    let dep = persistence::insert_pending(&pool, env, version, &git_sha).await?;
    persistence::audit(
        &pool,
        dep.id,
        "deploy_requested",
        json!({"version": version}),
    )
    .await?;

    let result = run_deploy(&docker, &cache, &pool, env, version, &dep).await;

    match result {
        Ok(migrations) => {
            maintenance::disable(&cache, env).await.ok();
            persistence::mark_success(&pool, dep.id, &migrations).await?;
            persistence::audit(&pool, dep.id, "deploy_succeeded", json!({})).await?;
            tracing::info!(%env, %version, "deployment succeeded");
            Ok(())
        },
        Err(e) => {
            let err_msg = format!("{e:#}");
            persistence::mark_failed(&pool, dep.id, &err_msg).await?;
            persistence::audit(
                &pool,
                dep.id,
                "deploy_failed",
                json!({ "error": err_msg.clone() }),
            )
            .await?;
            tracing::error!(%env, %version, error = %err_msg, "deployment failed");

            if let Some(prev) = dep.previous_version.clone() {
                tracing::warn!(%prev, "attempting auto-rollback");
                if let Err(re) = run_rollback(&docker, &cache, env, &prev).await {
                    tracing::error!(error = %re, "auto-rollback also failed; maintenance stays ON");
                } else {
                    persistence::mark_rolled_back(&pool, dep.id).await.ok();
                    persistence::audit(&pool, dep.id, "auto_rolled_back", json!({ "to": prev }))
                        .await?;
                    maintenance::disable(&cache, env).await.ok();
                }
            } else {
                tracing::warn!("no previous version to roll back to; maintenance stays ON");
            }
            Err(e)
        },
    }
}

async fn run_deploy(
    docker: &DockerClient,
    cache: &Arc<CacheService>,
    pool: &PgPool,
    env: &str,
    version: &str,
    dep: &persistence::Deployment,
) -> Result<Vec<String>> {
    persistence::mark_running(pool, dep.id).await?;

    // 1. Pull image
    let image_ref = format!("{IMAGE_REPO}:{version}");
    persistence::audit(
        pool,
        dep.id,
        "pulling_image",
        json!({ "image": &image_ref }),
    )
    .await?;
    docker.pull_image(&image_ref).await.context("pull image")?;

    // 2. Enable maintenance
    maintenance::enable(cache, env).await?;
    persistence::audit(pool, dep.id, "maintenance_on", json!({})).await?;

    // 3. Compose up -d
    persistence::audit(pool, dep.id, "compose_up", json!({})).await?;
    compose_up(version).await.context("docker compose up")?;

    // 4. Wait for healthchecks
    wait_healthy(docker).await.context("wait healthy")?;

    // 5. Run pending migrations
    persistence::audit(pool, dep.id, "migrations_start", json!({})).await?;
    let applied = migrate::run_pending(pool, &migrations_dir())
        .await
        .context("run migrations")?;
    persistence::audit(
        pool,
        dep.id,
        "migrations_applied",
        json!({ "count": applied.len(), "files": &applied }),
    )
    .await?;

    Ok(applied)
}

async fn compose_up(version: &str) -> Result<()> {
    let status = tokio::process::Command::new("docker")
        .args([
            "compose",
            "-f",
            "docker-compose.prod.yml",
            "--env-file",
            ".env.prod",
            "up",
            "-d",
        ])
        .env("SIGNAPPS_VERSION", version)
        .status()
        .await
        .context("spawn docker compose up")?;
    anyhow::ensure!(status.success(), "docker compose up failed");
    Ok(())
}

async fn wait_healthy(docker: &DockerClient) -> Result<()> {
    timeout(HEALTHCHECK_TIMEOUT, async {
        loop {
            let health = docker.health_by_project(COMPOSE_PROJECT).await?;
            if !health.is_empty() && health.values().all(|h| *h) {
                return Ok::<(), anyhow::Error>(());
            }
            let unhealthy = health.iter().filter(|(_, h)| !**h).count();
            tracing::info!(unhealthy_count = unhealthy, "waiting for healthy");
            sleep(HEALTHCHECK_POLL).await;
        }
    })
    .await
    .context("healthcheck timeout")?
}

/// Entry point: roll back to the last successful version.
pub async fn rollback(env: &str) -> Result<()> {
    let pool = connect_pool().await?;
    let cache = make_cache();
    let docker = DockerClient::connect()?;

    let (prev_version, _when) = persistence::last_successful(&pool, env)
        .await?
        .ok_or_else(|| anyhow::anyhow!("no successful deployment to roll back to"))?;

    tracing::warn!(%env, version = %prev_version, "manual rollback requested");
    run_rollback(&docker, &cache, env, &prev_version).await
}

async fn run_rollback(
    _docker: &DockerClient,
    cache: &Arc<CacheService>,
    env: &str,
    version: &str,
) -> Result<()> {
    maintenance::enable(cache, env).await?;
    compose_up(version).await?;
    maintenance::disable(cache, env).await?;
    Ok(())
}

/// Entry point: print deployment status.
pub async fn status(env: &str) -> Result<()> {
    let pool = connect_pool().await?;
    match persistence::last_successful(&pool, env).await? {
        Some((version, when)) => {
            println!("{env}: v{version} (deployed {when})");
        },
        None => println!("{env}: no successful deployment yet"),
    }
    Ok(())
}
