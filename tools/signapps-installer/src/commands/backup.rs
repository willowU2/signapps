//! `backup` — pg_dump into the backups dir.

use crate::config;
use anyhow::{bail, Context, Result};
use chrono::Utc;
use std::fs;
use std::path::PathBuf;

pub async fn run(config_dir: Option<PathBuf>, output_dir: Option<PathBuf>) -> Result<()> {
    let dir = config::resolve_config_dir(config_dir);
    let out = output_dir.unwrap_or_else(|| config::backups_dir(&dir));
    fs::create_dir_all(&out).context("create output dir")?;

    let timestamp = Utc::now().format("%Y%m%dT%H%M%S");
    let dump_path = out.join(format!("signapps-pg-{timestamp}.sql.gz"));

    #[allow(clippy::print_stdout)]
    {
        println!("→ pg_dump → {}", dump_path.display());
    }

    // Use docker exec for pg_dump so clients don't need a local psql client.
    // Pipe through gzip via shell (Windows: requires WSL or Docker-hosted shell).
    let dump_cmd = format!(
        "docker exec signapps-postgres pg_dump -U signapps -d signapps | gzip > {}",
        dump_path.to_str().context("path")?
    );

    let shell = if cfg!(target_os = "windows") {
        // On Windows, prefer bash (Git Bash / WSL) if available, else fall back to cmd
        // with a different approach. For the POC, we assume bash is available.
        "bash"
    } else {
        "sh"
    };

    let status = tokio::process::Command::new(shell)
        .arg("-c")
        .arg(&dump_cmd)
        .status()
        .await
        .context("spawn pg_dump")?;

    if !status.success() {
        bail!("pg_dump failed");
    }

    #[allow(clippy::print_stdout)]
    {
        println!("✓ Backup created at {}", dump_path.display());
        println!();
        println!("Note: this backup covers the Postgres database only.");
        println!("Docker volumes (storage_data, models_data) are NOT included");
        println!("— see INSTALL.md for volume snapshot instructions.");
    }

    Ok(())
}
