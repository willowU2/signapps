//! Docker API via SSH shell-out.
//!
//! Phase 5 MVP: invoke `ssh user@host docker ...` directly. The remote host
//! must have passwordless SSH key auth set up, Docker daemon running, and the
//! compose+env files pre-deployed at the paths passed in.
//!
//! A future optimisation is to use bollard's TLS transport for better
//! structured output and lower overhead.

use super::host::DockerHost;
use anyhow::{Context, Result};
use async_trait::async_trait;
use std::collections::HashMap;

/// Remote Docker host reachable via SSH shell-out.
pub struct RemoteDockerHost {
    /// e.g. `deploy@host.example.com` or `deploy@10.0.1.5`.
    ssh_target: String,
    /// Human-readable label for logs (e.g. `"host_green"`).
    label: String,
}

impl RemoteDockerHost {
    /// Construct a new remote host handle.
    pub fn new(ssh_target: String, label: String) -> Self {
        Self { ssh_target, label }
    }
}

#[async_trait]
impl DockerHost for RemoteDockerHost {
    async fn pull_image(&self, image_ref: &str) -> Result<()> {
        let status = tokio::process::Command::new("ssh")
            .arg(&self.ssh_target)
            .arg(format!("docker pull {image_ref}"))
            .status()
            .await
            .context("spawn ssh docker pull")?;
        anyhow::ensure!(
            status.success(),
            "ssh docker pull failed on {}",
            self.ssh_target
        );
        Ok(())
    }

    async fn health_by_project(&self, project: &str) -> Result<HashMap<String, bool>> {
        let out = tokio::process::Command::new("ssh")
            .arg(&self.ssh_target)
            .arg(format!(
                "docker ps -a --filter label=com.docker.compose.project={project} \
                 --format '{{{{.Names}}}}|{{{{.Status}}}}'"
            ))
            .output()
            .await
            .context("spawn ssh docker ps")?;
        if !out.status.success() {
            anyhow::bail!("ssh docker ps failed on {}", self.ssh_target);
        }
        let mut result = HashMap::new();
        for line in String::from_utf8_lossy(&out.stdout).lines() {
            if let Some((name, status)) = line.split_once('|') {
                result.insert(name.to_string(), status.contains("(healthy)"));
            }
        }
        Ok(result)
    }

    async fn compose_up(
        &self,
        compose_file: &str,
        env_file: &str,
        version_env: (&str, &str),
    ) -> Result<()> {
        let status = tokio::process::Command::new("ssh")
            .arg(&self.ssh_target)
            .arg(format!(
                "{}={} docker compose -f {compose_file} --env-file {env_file} up -d",
                version_env.0, version_env.1
            ))
            .status()
            .await
            .context("spawn ssh docker compose up")?;
        anyhow::ensure!(status.success(), "ssh docker compose up failed");
        Ok(())
    }

    async fn compose_down(&self, compose_file: &str, env_file: &str) -> Result<()> {
        let status = tokio::process::Command::new("ssh")
            .arg(&self.ssh_target)
            .arg(format!(
                "docker compose -f {compose_file} --env-file {env_file} down"
            ))
            .status()
            .await
            .context("spawn ssh docker compose down")?;
        anyhow::ensure!(status.success(), "ssh docker compose down failed");
        Ok(())
    }

    fn host_label(&self) -> &str {
        &self.label
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remote_host_stores_target_and_label() {
        let host = RemoteDockerHost::new("deploy@example.com".into(), "host_green".into());
        assert_eq!(host.host_label(), "host_green");
    }
}
