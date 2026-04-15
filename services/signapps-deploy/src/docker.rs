//! Docker API wrapper using bollard.
//!
//! Wraps the operations the orchestrator needs: connect, pull image,
//! and query health by compose project label.

use anyhow::{Context, Result};
use bollard::Docker;
use futures_util::TryStreamExt;
use std::collections::HashMap;

/// Thin async wrapper around [`bollard::Docker`] exposing only the operations
/// the deploy orchestrator needs.
pub struct DockerClient {
    inner: Docker,
}

impl DockerClient {
    /// Connect using the default local Docker socket.
    ///
    /// # Errors
    ///
    /// Returns an error if the Docker socket is unreachable or bollard cannot
    /// negotiate with the daemon.
    pub fn connect() -> Result<Self> {
        let inner = Docker::connect_with_local_defaults().context("connect to Docker socket")?;
        Ok(Self { inner })
    }

    /// Pull an image by ref (`ghcr.io/foo/bar:v1.2.3`).
    ///
    /// # Errors
    ///
    /// Returns an error if the daemon is unreachable, the image does not exist,
    /// or the pull fails for any other reason.
    pub async fn pull_image(&self, image_ref: &str) -> Result<()> {
        use bollard::image::CreateImageOptions;
        let opts = CreateImageOptions {
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

    /// Map container name to `is_healthy` for a given docker-compose project
    /// (filtered by `com.docker.compose.project=<project>` label).
    ///
    /// # Errors
    ///
    /// Returns an error if listing containers against the Docker daemon fails.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn docker_client_connect_does_not_panic_without_socket() {
        // Running on a host without Docker should yield Err, not panic.
        let _ = DockerClient::connect();
    }
}
