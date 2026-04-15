//! `init` — create the config directory, write embedded assets, seed config.toml.

use crate::{assets, config};
use anyhow::{bail, Context, Result};
use chrono::Utc;
use std::fs;
use std::path::PathBuf;

pub async fn run(config_dir: Option<PathBuf>, force: bool) -> Result<()> {
    let dir = config::resolve_config_dir(config_dir);

    if dir.exists() && !force {
        let cfg_path = config::config_file_path(&dir);
        if cfg_path.exists() {
            bail!(
                "config directory already initialised at {}. \
                 Pass --force to overwrite, or use a different --config-dir.",
                dir.display()
            );
        }
    }

    fs::create_dir_all(&dir)
        .with_context(|| format!("create config dir {}", dir.display()))?;
    fs::create_dir_all(config::backups_dir(&dir)).context("create backups dir")?;
    fs::create_dir_all(dir.join("data")).context("create data dir")?;

    fs::write(config::compose_file_path(&dir), assets::DOCKER_COMPOSE_YAML)
        .context("write docker-compose.prod.yml")?;

    let env_path = config::env_file_path(&dir);
    if !env_path.exists() {
        fs::write(&env_path, assets::ENV_EXAMPLE).context("write .env")?;
    }

    let cfg = config::InstallerConfig {
        installed_version: assets::INSTALLER_VERSION.to_string(),
        installed_at: Utc::now(),
        current_version: None,
        last_updated_at: None,
    };
    config::write_config(&dir, &cfg)?;

    // CLI user-facing output
    #[allow(clippy::print_stdout)]
    {
        println!("✓ SignApps initialised at {}", dir.display());
        println!();
        println!("Next steps:");
        println!("  1. Edit {}", env_path.display());
        println!("     (set POSTGRES_PASSWORD, JWT_*_KEY_PEM, other secrets)");
        println!("  2. Run: signapps-installer start");
    }

    Ok(())
}
