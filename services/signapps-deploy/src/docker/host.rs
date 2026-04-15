//! `DockerHost` trait — unifies local and remote Docker daemons.

use anyhow::Result;
use async_trait::async_trait;
use std::collections::HashMap;

/// A Docker daemon we can talk to — either local (via socket) or remote
/// (via SSH shell-out).
#[async_trait]
pub trait DockerHost: Send + Sync {
    /// Pull an image ref (e.g. `ghcr.io/foo/bar:v1.2.3`).
    async fn pull_image(&self, image_ref: &str) -> Result<()>;

    /// Map container name → is_healthy for a given compose project.
    async fn health_by_project(&self, project: &str) -> Result<HashMap<String, bool>>;

    /// Run `docker compose -f <compose_file> --env-file <env_file> up -d`
    /// with a single version env var.
    async fn compose_up(
        &self,
        compose_file: &str,
        env_file: &str,
        version_env: (&str, &str),
    ) -> Result<()>;

    /// Run `docker compose -f <compose_file> --env-file <env_file> down`.
    async fn compose_down(&self, compose_file: &str, env_file: &str) -> Result<()>;

    /// Human-readable host label for logs (e.g. `"local"` or `"user@host"`).
    fn host_label(&self) -> &str;
}
