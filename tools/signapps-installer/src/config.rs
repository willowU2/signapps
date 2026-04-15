//! Config directory + TOML file handling.
//!
//! Layout on disk:
//!   <config_dir>/
//!     config.toml              — installer metadata (version, created_at)
//!     docker-compose.prod.yml  — written from embedded asset
//!     .env                     — user-edited env file (seeded from embedded .env.example)
//!     data/                    — bind-mount for docker volumes (storage, models, backups)
//!     backups/                 — auto-backup destination
//!
//! Default config_dir:
//!   - Linux/macOS: /etc/signapps
//!   - Windows: %PROGRAMDATA%\signapps (typically C:\ProgramData\signapps)
//!
//! Users can override via --config-dir.

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize)]
pub struct InstallerConfig {
    pub installed_version: String,
    pub installed_at: DateTime<Utc>,
    pub current_version: Option<String>,
    pub last_updated_at: Option<DateTime<Utc>>,
}

pub fn default_config_dir() -> PathBuf {
    if cfg!(target_os = "windows") {
        std::env::var("PROGRAMDATA")
            .map(|p| PathBuf::from(p).join("signapps"))
            .unwrap_or_else(|_| PathBuf::from(r"C:\ProgramData\signapps"))
    } else {
        PathBuf::from("/etc/signapps")
    }
}

pub fn resolve_config_dir(override_: Option<PathBuf>) -> PathBuf {
    override_.unwrap_or_else(default_config_dir)
}

pub fn config_file_path(config_dir: &Path) -> PathBuf {
    config_dir.join("config.toml")
}

pub fn compose_file_path(config_dir: &Path) -> PathBuf {
    config_dir.join("docker-compose.prod.yml")
}

pub fn env_file_path(config_dir: &Path) -> PathBuf {
    config_dir.join(".env")
}

pub fn backups_dir(config_dir: &Path) -> PathBuf {
    config_dir.join("backups")
}

pub fn read_config(config_dir: &Path) -> Result<InstallerConfig> {
    let path = config_file_path(config_dir);
    let raw = std::fs::read_to_string(&path).with_context(|| format!("read {}", path.display()))?;
    let cfg: InstallerConfig = toml::from_str(&raw).context("parse installer config.toml")?;
    Ok(cfg)
}

pub fn write_config(config_dir: &Path, cfg: &InstallerConfig) -> Result<()> {
    let path = config_file_path(config_dir);
    let raw = toml::to_string_pretty(cfg).context("serialize installer config")?;
    std::fs::write(&path, raw).with_context(|| format!("write {}", path.display()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_dir_returns_platform_appropriate_path() {
        let d = default_config_dir();
        let s = d.to_string_lossy();
        if cfg!(target_os = "windows") {
            assert!(s.contains("signapps"));
        } else {
            assert_eq!(s, "/etc/signapps");
        }
    }

    #[test]
    fn resolve_config_dir_respects_override() {
        let override_ = PathBuf::from("/tmp/custom");
        assert_eq!(resolve_config_dir(Some(override_.clone())), override_);
    }
}
