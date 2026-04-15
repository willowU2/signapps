//! Docker API via local socket (Phase 1 behaviour).

use super::host::DockerHost;
use anyhow::{Context, Result};
use async_trait::async_trait;
use bollard::Docker;
use futures_util::TryStreamExt;
use std::collections::HashMap;

/// Local Docker client wrapper (kept under the legacy name for Phase 1-4 callers).
pub struct DockerClient {
    inner: Docker,
}

/// Alias — new code should use this name.
pub type LocalDockerHost = DockerClient;

impl DockerClient {
    /// Connect to the local Docker socket (unix socket on Linux/macOS,
    /// named pipe on Windows).
    ///
    /// # Errors
    ///
    /// Returns an error if Docker is not reachable.
    pub fn connect() -> Result<Self> {
        let inner = Docker::connect_with_local_defaults().context("connect to local Docker")?;
        Ok(Self { inner })
    }

    /// Pull an image by ref.
    ///
    /// # Errors
    ///
    /// Returns an error if the pull fails.
    pub async fn pull_image(&self, image_ref: &str) -> Result<()> {
        use bollard::image::CreateImageOptions;
        let opts = CreateImageOptions::<String> {
            from_image: image_ref.to_string(),
            ..Default::default()
        };
        self.inner
            .create_image(Some(opts), None, None)
            .try_for_each(|_| async { Ok(()) })
            .await
            .context("pull image")?;
        Ok(())
    }

    /// Health map for a compose project.
    ///
    /// # Errors
    ///
    /// Returns an error on Docker API failure.
    pub async fn health_by_project(&self, project: &str) -> Result<HashMap<String, bool>> {
        use bollard::container::ListContainersOptions;
        let mut filters: HashMap<String, Vec<String>> = HashMap::new();
        filters.insert(
            "label".to_string(),
            vec![format!("com.docker.compose.project={project}")],
        );
        let opts = ListContainersOptions::<String> {
            all: true,
            filters,
            ..Default::default()
        };
        let containers = self
            .inner
            .list_containers(Some(opts))
            .await
            .context("list containers")?;
        let mut out = HashMap::new();
        for c in containers {
            let name = c
                .names
                .and_then(|n| n.into_iter().next())
                .unwrap_or_default();
            let healthy = c
                .status
                .as_deref()
                .map(|s| s.contains("(healthy)"))
                .unwrap_or(false);
            out.insert(name, healthy);
        }
        Ok(out)
    }
}

#[async_trait]
impl DockerHost for DockerClient {
    async fn pull_image(&self, image_ref: &str) -> Result<()> {
        DockerClient::pull_image(self, image_ref).await
    }

    async fn health_by_project(&self, project: &str) -> Result<HashMap<String, bool>> {
        DockerClient::health_by_project(self, project).await
    }

    async fn compose_up(
        &self,
        compose_file: &str,
        env_file: &str,
        version_env: (&str, &str),
    ) -> Result<()> {
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
            .env(version_env.0, version_env.1)
            .status()
            .await
            .context("spawn docker compose up")?;
        anyhow::ensure!(status.success(), "docker compose up failed");
        Ok(())
    }

    async fn compose_down(&self, compose_file: &str, env_file: &str) -> Result<()> {
        let status = tokio::process::Command::new("docker")
            .args([
                "compose",
                "-f",
                compose_file,
                "--env-file",
                env_file,
                "down",
            ])
            .status()
            .await
            .context("spawn docker compose down")?;
        anyhow::ensure!(status.success(), "docker compose down failed");
        Ok(())
    }

    fn host_label(&self) -> &str {
        "local"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn docker_client_connect_does_not_panic_without_socket() {
        // Running on a host without Docker should yield Err, not panic.
        let _ = DockerClient::connect();
    }
}
