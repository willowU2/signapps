//! `stop` — run `docker compose down`.

use crate::config;
use anyhow::{bail, Context, Result};
use std::path::PathBuf;

pub async fn run(config_dir: Option<PathBuf>) -> Result<()> {
    let dir = config::resolve_config_dir(config_dir);
    let compose = config::compose_file_path(&dir);
    let env = config::env_file_path(&dir);

    if !compose.exists() {
        bail!(
            "No docker-compose.prod.yml at {}. Nothing to stop.",
            dir.display()
        );
    }

    let status = tokio::process::Command::new("docker")
        .args([
            "compose",
            "-f",
            compose.to_str().context("path")?,
            "--env-file",
            env.to_str().context("path")?,
            "down",
        ])
        .status()
        .await
        .context("spawn docker compose down")?;

    if !status.success() {
        bail!("docker compose down failed");
    }

    #[allow(clippy::print_stdout)]
    {
        println!("✓ SignApps stopped");
    }
    Ok(())
}
