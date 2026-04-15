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
//!
//! ## Migration policy
//!
//! Phase 1 does NOT auto-apply SQL migrations. The orchestrator only lists
//! pending migrations and logs a warning. An operator applies them manually
//! during the maintenance window. This matches the spec's explicit decision
//! to accept a maintenance window rather than enforce backward-compatible
//! migrations.

use crate::{docker::DockerClient, maintenance, migrate, persistence};
use anyhow::{Context, Result};
use serde_json::json;
use sqlx::PgPool;
use std::path::PathBuf;
use std::time::Duration;
use tokio::time::{sleep, timeout};

const HEALTHCHECK_TIMEOUT: Duration = Duration::from_secs(300);
const HEALTHCHECK_POLL: Duration = Duration::from_secs(2);
/// Max polls where the project container list is empty before failing.
/// Protects against silent misconfiguration (wrong project label, compose
/// refused to create containers, etc.).
const HEALTHCHECK_MAX_EMPTY_POLLS: u32 = 5;
/// Default compose project name. Phase 2 will parameterize this per env.
const DEFAULT_COMPOSE_PROJECT: &str = "signapps-prod";
/// Env var for the image repo (defaults only for tests — real deploys MUST set it).
const IMAGE_REPO_ENV: &str = "DEPLOY_IMAGE_REPO";
/// Advisory lock id — arbitrary constant 64-bit key shared across all
/// deployment processes. A single process at a time holds this lock,
/// ensuring at most one deploy operation per DB.
const DEPLOY_ADVISORY_LOCK: i64 = 0x5133_4B01_DEAD_BEEF_i64;

/// Build the path to the repo's `migrations/` directory from the binary's CWD.
fn migrations_dir() -> PathBuf {
    PathBuf::from("migrations")
}

async fn connect_pool() -> Result<PgPool> {
    let url = std::env::var("DATABASE_URL").context("DATABASE_URL not set")?;
    Ok(PgPool::connect(&url).await?)
}

/// Resolve the image repo from the `DEPLOY_IMAGE_REPO` env var.
///
/// Fails fast with a clear error if unset — this prevents silent failures
/// where every image pull hits a placeholder registry.
fn image_repo() -> Result<String> {
    std::env::var(IMAGE_REPO_ENV).with_context(|| {
        format!(
            "{IMAGE_REPO_ENV} is not set. Set it to your image repository \
             (e.g. 'ghcr.io/myorg/signapps-platform') before running a deploy."
        )
    })
}

/// Compose project name for the given env. Phase 2 will add dev.
fn compose_project(env: &str) -> &'static str {
    match env {
        "prod" => "signapps-prod",
        "dev" => "signapps-staging",
        _ => DEFAULT_COMPOSE_PROJECT,
    }
}

/// Acquire the deployment advisory lock on the DB. Returns an error if
/// another deployment is already in progress.
async fn acquire_deploy_lock(pool: &PgPool) -> Result<()> {
    let got: bool = sqlx::query_scalar("SELECT pg_try_advisory_lock($1)")
        .bind(DEPLOY_ADVISORY_LOCK)
        .fetch_one(pool)
        .await
        .context("acquire advisory lock")?;
    if !got {
        anyhow::bail!(
            "another deployment is already in progress (advisory lock held). \
             Wait for it to finish or investigate a stuck 'running' row."
        );
    }
    Ok(())
}

/// Release the deployment advisory lock. Best-effort — logged on failure
/// because holding the lock across a process death is recoverable
/// (the session ends, the lock is released automatically by PostgreSQL).
async fn release_deploy_lock(pool: &PgPool) {
    let res: Result<bool, _> = sqlx::query_scalar("SELECT pg_advisory_unlock($1)")
        .bind(DEPLOY_ADVISORY_LOCK)
        .fetch_one(pool)
        .await;
    if let Err(e) = res {
        tracing::warn!(error = %e, "failed to release advisory lock (will expire on disconnect)");
    }
}

/// Entry point: deploy a version to an environment.
pub async fn deploy(env: &str, version: &str) -> Result<()> {
    let pool = connect_pool().await?;
    acquire_deploy_lock(&pool).await?;

    let result = deploy_inner(&pool, env, version).await;

    release_deploy_lock(&pool).await;
    result
}

async fn deploy_inner(pool: &PgPool, env: &str, version: &str) -> Result<()> {
    let docker = DockerClient::connect()?;

    let git_sha = std::env::var("GIT_SHA").unwrap_or_else(|_| "unknown".to_string());
    let dep = persistence::insert_pending(pool, env, version, &git_sha).await?;
    persistence::audit(
        pool,
        dep.id,
        "deploy_requested",
        json!({"version": version}),
    )
    .await?;

    let result = run_deploy(&docker, pool, env, version, &dep).await;

    match result {
        Ok(migrations) => {
            maintenance::disable(pool, env).await.ok();
            persistence::mark_success(pool, dep.id, &migrations).await?;
            persistence::audit(pool, dep.id, "deploy_succeeded", json!({})).await?;
            tracing::info!(%env, %version, "deployment succeeded");
            Ok(())
        },
        Err(e) => {
            let err_msg = format!("{e:#}");
            persistence::mark_failed(pool, dep.id, &err_msg).await?;
            persistence::audit(
                pool,
                dep.id,
                "deploy_failed",
                json!({ "error": err_msg.clone() }),
            )
            .await?;
            tracing::error!(%env, %version, error = %err_msg, "deployment failed");

            if let Some(prev) = dep.previous_version.clone() {
                tracing::warn!(%prev, "attempting auto-rollback");
                if let Err(re) = run_rollback(&docker, pool, env, &prev).await {
                    tracing::error!(error = %re, "auto-rollback also failed; maintenance stays ON");
                } else {
                    persistence::mark_rolled_back(pool, dep.id).await.ok();
                    persistence::audit(pool, dep.id, "auto_rolled_back", json!({ "to": prev }))
                        .await?;
                    maintenance::disable(pool, env).await.ok();
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
    pool: &PgPool,
    env: &str,
    version: &str,
    dep: &persistence::Deployment,
) -> Result<Vec<String>> {
    persistence::mark_running(pool, dep.id).await?;

    // 1. Pull image
    let image_ref = format!("{}:{version}", image_repo()?);
    persistence::audit(
        pool,
        dep.id,
        "pulling_image",
        json!({ "image": &image_ref }),
    )
    .await?;
    docker.pull_image(&image_ref).await.context("pull image")?;

    // 2. Enable maintenance
    maintenance::enable(pool, env).await?;
    persistence::audit(pool, dep.id, "maintenance_on", json!({})).await?;

    // 3. Compose up -d
    persistence::audit(pool, dep.id, "compose_up", json!({})).await?;
    compose_up(env, version)
        .await
        .context("docker compose up")?;

    // 4. Wait for healthchecks
    wait_healthy(docker, compose_project(env))
        .await
        .context("wait healthy")?;

    // 5. Check pending migrations (do NOT auto-apply in Phase 1 — see module docstring).
    let pending = migrate::pending_migrations(pool, &migrations_dir())
        .await
        .context("list pending migrations")?;
    if !pending.is_empty() {
        tracing::warn!(
            count = pending.len(),
            files = ?pending,
            "pending SQL migrations detected. Phase 1 requires manual application \
             during the maintenance window before declaring the deploy live."
        );
        persistence::audit(
            pool,
            dep.id,
            "migrations_pending_manual",
            json!({ "count": pending.len(), "files": &pending }),
        )
        .await?;
    } else {
        persistence::audit(pool, dep.id, "migrations_none_pending", json!({})).await?;
    }

    Ok(Vec::new())
}

async fn compose_up(env: &str, version: &str) -> Result<()> {
    let (compose_file, env_file, version_var) = match env {
        "prod" => ("docker-compose.prod.yml", ".env.prod", "SIGNAPPS_VERSION"),
        "dev" => (
            "docker-compose.staging.yml",
            ".env.dev",
            "SIGNAPPS_STAGING_VERSION",
        ),
        _ => anyhow::bail!("unknown env: {env}"),
    };
    let status = tokio::process::Command::new("docker")
        .args([
            "compose",
            "-f",
            compose_file,
            "--env-file",
            env_file,
            "up",
            "-d",
        ])
        .env(version_var, version)
        .status()
        .await
        .context("spawn docker compose up")?;
    anyhow::ensure!(status.success(), "docker compose up failed on env={env}");
    Ok(())
}

async fn wait_healthy(docker: &DockerClient, project: &str) -> Result<()> {
    timeout(HEALTHCHECK_TIMEOUT, async {
        let mut empty_polls: u32 = 0;
        loop {
            let health = docker.health_by_project(project).await?;
            if health.is_empty() {
                empty_polls += 1;
                if empty_polls >= HEALTHCHECK_MAX_EMPTY_POLLS {
                    anyhow::bail!(
                        "no containers found for compose project '{project}' after \
                         {empty_polls} polls. Check the project label or compose config."
                    );
                }
                tracing::info!(project, empty_polls, "no containers yet, retrying");
                sleep(HEALTHCHECK_POLL).await;
                continue;
            }
            if health.values().all(|h| *h) {
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
    acquire_deploy_lock(&pool).await?;

    let result = rollback_inner(&pool, env).await;

    release_deploy_lock(&pool).await;
    result
}

async fn rollback_inner(pool: &PgPool, env: &str) -> Result<()> {
    let docker = DockerClient::connect()?;

    let (prev_version, _when) = persistence::last_successful(pool, env)
        .await?
        .ok_or_else(|| anyhow::anyhow!("no successful deployment to roll back to"))?;

    tracing::warn!(%env, version = %prev_version, "manual rollback requested");
    run_rollback(&docker, pool, env, &prev_version).await
}

async fn run_rollback(
    _docker: &DockerClient,
    pool: &PgPool,
    env: &str,
    version: &str,
) -> Result<()> {
    maintenance::enable(pool, env).await?;
    compose_up(env, version).await?;
    maintenance::disable(pool, env).await?;
    Ok(())
}

/// Entry point: print deployment status.
#[allow(clippy::print_stdout)] // intentional CLI user-facing output
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

/// Resolve the default strategy from `DEPLOY_STRATEGY`.
///
/// Returns a boxed trait object so the orchestrator dispatches uniformly.
/// `blue_green` is NOT selectable from env alone — it requires explicit
/// construction with hosts + image_repo (see `BlueGreenStrategy::new`).
/// Passing `DEPLOY_STRATEGY=blue_green` without that construction is a
/// configuration error and panics fast.
///
/// # Panics
///
/// - If `DEPLOY_STRATEGY` is `blue_green` (use explicit strategy construction
///   for BG deploys).
/// - If `DEPLOY_STRATEGY` is an unknown value.
pub fn resolve_strategy() -> Box<dyn crate::strategies::DeploymentStrategy> {
    let name = std::env::var("DEPLOY_STRATEGY")
        .unwrap_or_else(|_| "maintenance_window".into());
    match name.as_str() {
        "maintenance_window" => Box::new(
            crate::strategies::maintenance_window::MaintenanceWindowStrategy,
        ),
        "blue_green" => panic!(
            "blue_green strategy requires explicit construction with DockerHosts + image_repo. \
             Build a BlueGreenStrategy and call its deploy/rollback directly, or wire the \
             factory in the server binary."
        ),
        other => panic!("unknown DEPLOY_STRATEGY: {other}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compose_project_maps_known_envs() {
        assert_eq!(compose_project("prod"), "signapps-prod");
        assert_eq!(compose_project("dev"), "signapps-staging");
        assert_eq!(compose_project("unknown"), DEFAULT_COMPOSE_PROJECT);
    }
}
