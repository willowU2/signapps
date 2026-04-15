//! `update <version>` — pull a specific image tag and recreate containers.

use crate::config;
use anyhow::{bail, Context, Result};
use chrono::Utc;
use std::path::PathBuf;

pub async fn run(config_dir: Option<PathBuf>, version: &str) -> Result<()> {
    let dir = config::resolve_config_dir(config_dir);
    let compose = config::compose_file_path(&dir);
    let env = config::env_file_path(&dir);

    if !compose.exists() {
        bail!(
            "No docker-compose.prod.yml at {}. Run `init` first.",
            dir.display()
        );
    }

    #[allow(clippy::print_stdout)]
    {
        println!("→ Pulling images for version {version}…");
    }

    let pull = tokio::process::Command::new("docker")
        .args([
            "compose",
            "-f",
            compose.to_str().context("path")?,
            "--env-file",
            env.to_str().context("path")?,
            "pull",
        ])
        .env("SIGNAPPS_VERSION", version)
        .status()
        .await
        .context("spawn docker compose pull")?;

    if !pull.success() {
        bail!("docker compose pull failed for version {version}");
    }

    #[allow(clippy::print_stdout)]
    {
        println!("→ Recreating containers…");
    }

    let up = tokio::process::Command::new("docker")
        .args([
            "compose",
            "-f",
            compose.to_str().context("path")?,
            "--env-file",
            env.to_str().context("path")?,
            "up",
            "-d",
        ])
        .env("SIGNAPPS_VERSION", version)
        .status()
        .await
        .context("spawn docker compose up")?;

    if !up.success() {
        bail!("docker compose up failed");
    }

    let mut cfg = config::read_config(&dir)?;
    cfg.current_version = Some(version.to_string());
    cfg.last_updated_at = Some(Utc::now());
    config::write_config(&dir, &cfg)?;

    #[allow(clippy::print_stdout)]
    {
        println!("✓ SignApps updated to {version}");
    }
    Ok(())
}
