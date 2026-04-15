//! `start` — run `docker compose up -d` using the generated config.

use crate::config;
use anyhow::{bail, Context, Result};
use std::path::PathBuf;

pub async fn run(config_dir: Option<PathBuf>) -> Result<()> {
    let dir = config::resolve_config_dir(config_dir);
    let compose = config::compose_file_path(&dir);
    let env = config::env_file_path(&dir);

    if !compose.exists() {
        bail!(
            "No docker-compose.prod.yml in {}. Run `signapps-installer init` first.",
            dir.display()
        );
    }

    let status = tokio::process::Command::new("docker")
        .args([
            "compose",
            "-f",
            compose
                .to_str()
                .context("config dir path has non-UTF8 bytes")?,
            "--env-file",
            env.to_str().context("env file path has non-UTF8 bytes")?,
            "up",
            "-d",
        ])
        .status()
        .await
        .context("spawn docker compose up")?;

    if !status.success() {
        bail!("docker compose up failed");
    }

    #[allow(clippy::print_stdout)]
    {
        println!("✓ SignApps started");
    }
    Ok(())
}
