//! Deployment state machine — fleshed out in Task 11.

use anyhow::Result;

/// Deploy a specific `version` to the target `env`.
///
/// # Errors
///
/// Always returns an error in Phase 1 — implementation deferred to Task 11.
pub async fn deploy(env: &str, version: &str) -> Result<()> {
    tracing::info!(%env, %version, "deploy not yet implemented");
    anyhow::bail!("deploy not yet implemented")
}

/// Roll back the last successful deployment of `env`.
///
/// # Errors
///
/// Always returns an error in Phase 1 — implementation deferred to Task 11.
pub async fn rollback(env: &str) -> Result<()> {
    tracing::info!(%env, "rollback not yet implemented");
    anyhow::bail!("rollback not yet implemented")
}

/// Show deployment status for `env`.
///
/// # Errors
///
/// Always returns an error in Phase 1 — implementation deferred to Task 11.
pub async fn status(env: &str) -> Result<()> {
    tracing::info!(%env, "status not yet implemented");
    anyhow::bail!("status not yet implemented")
}
