# Multi-Env Deployment — Phase 4 (On-premise installer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer un binaire `signapps-installer` autonome qui permet à un client on-premise d'installer et de maintenir SignApps sur son propre serveur avec `init`, `start`, `update <version>`, `status`, `backup`. Les fichiers de config (`docker-compose.prod.yml`, `.env.example`) sont **embarqués dans le binaire** pour que le client n'ait rien à télécharger en plus.

**Architecture:** Nouveau crate binaire `tools/signapps-installer` (pas `services/` car c'est une CLI destinée au client, pas un service qui tourne). Assets embarqués via `include_str!`. Docker orchestration via l'API `bollard` (même pattern que `signapps-deploy`). Pas de dépendance à la DB — l'installer crée la config, le client gère le reste via docker-compose classique ou via l'installer.

**Tech Stack:** Rust 1.75+, `clap` (CLI), `bollard` (Docker), `include_str!` (assets), `tokio`, `anyhow`, `tracing`. Aucune dépendance signapps interne — le binaire doit être **totalement autonome** (pas de link avec signapps-db, signapps-common, etc.).

**Scope:** Phase 4 uniquement. Prérequis : image backend + frontend disponibles sur `ghcr.io/<org>/signapps-platform` et `ghcr.io/<org>/signapps-frontend` (Phase 2 CI workflow `.github/workflows/build-and-push.yml`). Pour cette phase on assume que le client a Docker Desktop ou Docker Engine installé — pas d'installation Docker dans notre scope.

---

## File Structure

### Fichiers créés

| Fichier | Responsabilité |
|---|---|
| `tools/signapps-installer/Cargo.toml` | Manifeste autonome (pas d'usage workspace deps signapps) |
| `tools/signapps-installer/build.rs` | Génération infos version (vergen) |
| `tools/signapps-installer/src/main.rs` | Entry point CLI |
| `tools/signapps-installer/src/cli.rs` | Définition des 5 commandes |
| `tools/signapps-installer/src/config.rs` | Gestion de `/etc/signapps/config.toml` |
| `tools/signapps-installer/src/assets.rs` | Assets embarqués via `include_str!` |
| `tools/signapps-installer/src/commands/init.rs` | Commande `init` |
| `tools/signapps-installer/src/commands/start.rs` | Commande `start` |
| `tools/signapps-installer/src/commands/stop.rs` | Commande `stop` |
| `tools/signapps-installer/src/commands/update.rs` | Commande `update <version>` |
| `tools/signapps-installer/src/commands/status.rs` | Commande `status` |
| `tools/signapps-installer/src/commands/backup.rs` | Commande `backup` |
| `tools/signapps-installer/src/commands/mod.rs` | Module re-exports |
| `tools/signapps-installer/assets/.env.example` | Template env file (copié depuis root) |
| `tools/signapps-installer/tests/cli_smoke.rs` | Tests E2E (help, version) |
| `docs/onprem/INSTALL.md` | Guide d'installation pour clients |

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `Cargo.toml` (workspace) | Ajouter `tools/signapps-installer` aux members |
| `.github/workflows/build-and-push.yml` | (Phase 4 optional) ajouter un job de cross-compilation pour produire les binaires Linux/macOS/Windows en release |

---

## Task 1: Scaffold crate `signapps-installer`

**Files:**
- Create: `tools/signapps-installer/Cargo.toml`
- Create: `tools/signapps-installer/build.rs`
- Create: `tools/signapps-installer/src/main.rs` (stub)
- Create: `tools/signapps-installer/src/cli.rs` (stub)
- Modify: `Cargo.toml` (workspace)

- [ ] **Step 1: Cargo.toml**

```toml
[package]
name = "signapps-installer"
version.workspace = true
edition = "2021"
rust-version = "1.75"
authors.workspace = true
license.workspace = true
description = "On-premise installer for SignApps Platform"

[[bin]]
name = "signapps-installer"
path = "src/main.rs"

[dependencies]
anyhow = { workspace = true }
bollard = "0.16"
chrono = { workspace = true }
clap = { version = "4", features = ["derive"] }
dirs = "5"
futures-util = "0.3"
serde = { workspace = true }
serde_json = { workspace = true }
toml = "0.8"
tokio = { workspace = true, features = ["full"] }
tracing = { workspace = true }
tracing-subscriber = { workspace = true }
uuid = { workspace = true }

[build-dependencies]
vergen = { version = "8", features = ["build", "cargo", "git", "gitcl", "rustc"] }

[dev-dependencies]
assert_cmd = "2"
tempfile = "3"
```

Note: `bollard` matches the workspace-pinned version. `dirs` provides cross-platform paths (home dir, config dir). `toml` for the config file.

- [ ] **Step 2: Register in workspace**

In root `Cargo.toml`, `[workspace] members` list, add `"tools/signapps-installer"` alphabetically.

- [ ] **Step 3: build.rs**

```rust
use vergen::EmitBuilder;

fn main() {
    EmitBuilder::builder()
        .all_build()
        .all_git()
        .emit()
        .expect("vergen should emit env vars");
}
```

- [ ] **Step 4: main.rs + cli.rs stubs**

`src/main.rs`:

```rust
//! SignApps Platform — On-premise installer.
//!
//! Self-contained binary that embeds `docker-compose.prod.yml` and the env
//! template, and drives Docker to initialise, start, update, and back up a
//! SignApps deployment on the user's own server.

mod assets;
mod cli;
mod commands;
mod config;

use clap::Parser;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_target(false)
        .with_level(true)
        .init();

    let args = cli::Cli::parse();
    args.execute().await
}
```

`src/cli.rs` (stub):

```rust
//! CLI surface — 5 commands for the on-premise workflow.

use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "signapps-installer", about = "On-premise installer for SignApps Platform", version)]
pub struct Cli {
    /// Config directory (defaults to `/etc/signapps` on Linux, `%PROGRAMDATA%/signapps` on Windows).
    #[arg(long, global = true)]
    pub config_dir: Option<PathBuf>,

    #[command(subcommand)]
    pub command: Command,
}

#[derive(Subcommand)]
pub enum Command {
    /// Initialise a new SignApps deployment in the config directory.
    Init {
        /// Overwrite an existing config.
        #[arg(long)]
        force: bool,
    },
    /// Start the stack.
    Start,
    /// Stop the stack.
    Stop,
    /// Pull a specific version and recreate the containers.
    Update {
        #[arg(long)]
        version: String,
    },
    /// Show the health of the running stack.
    Status,
    /// Backup the PG database + volumes.
    Backup {
        /// Output directory (defaults to config_dir/backups).
        #[arg(long)]
        output_dir: Option<PathBuf>,
    },
}

impl Cli {
    pub async fn execute(self) -> anyhow::Result<()> {
        match self.command {
            Command::Init { force } => crate::commands::init::run(self.config_dir, force).await,
            Command::Start => crate::commands::start::run(self.config_dir).await,
            Command::Stop => crate::commands::stop::run(self.config_dir).await,
            Command::Update { version } => crate::commands::update::run(self.config_dir, &version).await,
            Command::Status => crate::commands::status::run(self.config_dir).await,
            Command::Backup { output_dir } => crate::commands::backup::run(self.config_dir, output_dir).await,
        }
    }
}
```

- [ ] **Step 5: Module stubs for commands**

`src/commands/mod.rs`:
```rust
pub mod backup;
pub mod init;
pub mod start;
pub mod status;
pub mod stop;
pub mod update;
```

Each stub file (`init.rs`, `start.rs`, etc.):
```rust
//! Placeholder — filled in later tasks.

use std::path::PathBuf;

pub async fn run(_config_dir: Option<PathBuf>) -> anyhow::Result<()> {
    anyhow::bail!("not yet implemented")
}
```

For `update.rs` and `backup.rs` adapt the signature:
```rust
// update.rs
pub async fn run(_config_dir: Option<PathBuf>, _version: &str) -> anyhow::Result<()> {
    anyhow::bail!("not yet implemented")
}

// backup.rs
pub async fn run(_config_dir: Option<PathBuf>, _output_dir: Option<PathBuf>) -> anyhow::Result<()> {
    anyhow::bail!("not yet implemented")
}

// init.rs
pub async fn run(_config_dir: Option<PathBuf>, _force: bool) -> anyhow::Result<()> {
    anyhow::bail!("not yet implemented")
}
```

- [ ] **Step 6: Assets + config stubs**

`src/assets.rs`:
```rust
//! Embedded assets — populated in Task 2.
```

`src/config.rs`:
```rust
//! Config file handling — populated in Task 3.
```

- [ ] **Step 7: Build + smoke test**

```
cargo check -p signapps-installer
cargo run -p signapps-installer -- --help
cargo run -p signapps-installer -- init  # should print "not yet implemented" and exit 1
```

- [ ] **Step 8: Commit**

```bash
rtk git add Cargo.toml tools/signapps-installer/
rtk git commit -m "feat(installer): scaffold signapps-installer binary with 6 CLI commands"
```

---

## Task 2: Embedded assets

**Files:**
- Modify: `tools/signapps-installer/src/assets.rs`
- Create: `tools/signapps-installer/assets/docker-compose.prod.yml` (symlink or copy)
- Create: `tools/signapps-installer/assets/env.example`

- [ ] **Step 1: Copy assets**

The installer binary needs to embed `docker-compose.prod.yml` and `.env.example` at compile time. Instead of symlinking (which doesn't embed well across platforms), copy the files into `assets/` at build time via `build.rs`. But since assets are static and we want a clean audit, just copy them manually as a Task 2 artefact.

Run:
```bash
cp docker-compose.prod.yml tools/signapps-installer/assets/docker-compose.prod.yml
cp .env.example tools/signapps-installer/assets/env.example
```

- [ ] **Step 2: Implement assets.rs**

```rust
//! Embedded assets — baked into the binary at compile time.
//!
//! The installer writes these out at `init` time into the config directory
//! so the user has real files on disk to inspect and customise.

/// `docker-compose.prod.yml` — the SignApps production stack definition.
///
/// Embedded at compile time so the installer is self-contained.
pub const DOCKER_COMPOSE_YAML: &str = include_str!("../assets/docker-compose.prod.yml");

/// `.env.example` — template env file the user fills in.
pub const ENV_EXAMPLE: &str = include_str!("../assets/env.example");

/// Installer version (from vergen).
pub const INSTALLER_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const GIT_SHA: &str = env!("VERGEN_GIT_SHA");
pub const BUILD_TIME: &str = env!("VERGEN_BUILD_TIMESTAMP");
```

- [ ] **Step 3: Build**

```
cargo check -p signapps-installer
```

- [ ] **Step 4: Commit**

```bash
rtk git add tools/signapps-installer/
rtk git commit -m "feat(installer): embed docker-compose and env.example assets"
```

---

## Task 3: Config file handling

**Files:**
- Modify: `tools/signapps-installer/src/config.rs`

- [ ] **Step 1: Implement**

```rust
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

impl InstallerConfig {
    pub fn new_from_current(current_version: String) -> Self {
        Self {
            installed_version: crate::assets::INSTALLER_VERSION.to_string(),
            installed_at: Utc::now(),
            current_version: Some(current_version),
            last_updated_at: Some(Utc::now()),
        }
    }
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
    let raw = std::fs::read_to_string(&path)
        .with_context(|| format!("read {}", path.display()))?;
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
```

- [ ] **Step 2: Build + tests**

```
cargo nextest run -p signapps-installer config
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
rtk git add tools/signapps-installer/src/config.rs
rtk git commit -m "feat(installer): config directory + TOML file handling"
```

---

## Task 4: `init` command

**Files:**
- Modify: `tools/signapps-installer/src/commands/init.rs`

- [ ] **Step 1: Implement**

```rust
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
    fs::create_dir_all(config::backups_dir(&dir))
        .with_context(|| format!("create backups dir"))?;
    fs::create_dir_all(dir.join("data"))
        .with_context(|| format!("create data dir"))?;

    // Write embedded assets
    fs::write(config::compose_file_path(&dir), assets::DOCKER_COMPOSE_YAML)
        .context("write docker-compose.prod.yml")?;

    // .env is seeded from the template — user fills it in before start.
    let env_path = config::env_file_path(&dir);
    if !env_path.exists() {
        fs::write(&env_path, assets::ENV_EXAMPLE).context("write .env")?;
    }

    // Write the installer config
    let cfg = config::InstallerConfig {
        installed_version: assets::INSTALLER_VERSION.to_string(),
        installed_at: Utc::now(),
        current_version: None,
        last_updated_at: None,
    };
    config::write_config(&dir, &cfg)?;

    println!("✓ SignApps initialised at {}", dir.display());
    println!();
    println!("Next steps:");
    println!("  1. Edit {}", env_path.display());
    println!("     (set POSTGRES_PASSWORD, JWT_*_KEY_PEM, other secrets)");
    println!("  2. Run: signapps-installer start");

    Ok(())
}
```

- [ ] **Step 2: Smoke test**

```
cargo run -p signapps-installer -- --config-dir /tmp/signapps-test init
ls -la /tmp/signapps-test/
cat /tmp/signapps-test/config.toml
rm -rf /tmp/signapps-test
```

- [ ] **Step 3: Commit**

```bash
rtk git add tools/signapps-installer/src/commands/init.rs
rtk git commit -m "feat(installer): init command creates config dir + writes embedded assets"
```

---

## Task 5: `start` and `stop` commands

**Files:**
- Modify: `tools/signapps-installer/src/commands/start.rs`
- Modify: `tools/signapps-installer/src/commands/stop.rs`

- [ ] **Step 1: start.rs**

```rust
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
            compose.to_str().context("config dir has non-UTF8 path")?,
            "--env-file",
            env.to_str().context("env file has non-UTF8 path")?,
            "up",
            "-d",
        ])
        .status()
        .await
        .context("spawn docker compose up")?;

    if !status.success() {
        bail!("docker compose up failed");
    }

    println!("✓ SignApps started");
    Ok(())
}
```

- [ ] **Step 2: stop.rs**

```rust
//! `stop` — run `docker compose down`.

use crate::config;
use anyhow::{bail, Context, Result};
use std::path::PathBuf;

pub async fn run(config_dir: Option<PathBuf>) -> Result<()> {
    let dir = config::resolve_config_dir(config_dir);
    let compose = config::compose_file_path(&dir);
    let env = config::env_file_path(&dir);

    if !compose.exists() {
        bail!("No docker-compose.prod.yml at {}. Nothing to stop.", dir.display());
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

    println!("✓ SignApps stopped");
    Ok(())
}
```

- [ ] **Step 3: Build**

```
cargo build -p signapps-installer
```

- [ ] **Step 4: Commit**

```bash
rtk git add tools/signapps-installer/src/commands/
rtk git commit -m "feat(installer): start and stop commands via docker compose"
```

---

## Task 6: `update` command

**Files:**
- Modify: `tools/signapps-installer/src/commands/update.rs`

- [ ] **Step 1: Implement**

```rust
//! `update <version>` — pull a specific image tag and recreate containers.
//!
//! Exports `SIGNAPPS_VERSION=<version>` before calling docker compose up -d,
//! which causes the compose file's image references to resolve to the new tag.

use crate::config;
use anyhow::{bail, Context, Result};
use chrono::Utc;
use std::path::PathBuf;

pub async fn run(config_dir: Option<PathBuf>, version: &str) -> Result<()> {
    let dir = config::resolve_config_dir(config_dir);
    let compose = config::compose_file_path(&dir);
    let env = config::env_file_path(&dir);

    if !compose.exists() {
        bail!("No docker-compose.prod.yml at {}. Run `init` first.", dir.display());
    }

    println!("→ Pulling images for version {version}…");

    let pull = tokio::process::Command::new("docker")
        .args([
            "compose",
            "-f", compose.to_str().context("path")?,
            "--env-file", env.to_str().context("path")?,
            "pull",
        ])
        .env("SIGNAPPS_VERSION", version)
        .status()
        .await
        .context("spawn docker compose pull")?;

    if !pull.success() {
        bail!("docker compose pull failed for version {version}");
    }

    println!("→ Recreating containers…");

    let up = tokio::process::Command::new("docker")
        .args([
            "compose",
            "-f", compose.to_str().context("path")?,
            "--env-file", env.to_str().context("path")?,
            "up", "-d",
        ])
        .env("SIGNAPPS_VERSION", version)
        .status()
        .await
        .context("spawn docker compose up")?;

    if !up.success() {
        bail!("docker compose up failed");
    }

    // Update persisted config
    let mut cfg = config::read_config(&dir)?;
    cfg.current_version = Some(version.to_string());
    cfg.last_updated_at = Some(Utc::now());
    config::write_config(&dir, &cfg)?;

    println!("✓ SignApps updated to {version}");
    Ok(())
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add tools/signapps-installer/src/commands/update.rs
rtk git commit -m "feat(installer): update command pulls + recreates at target version"
```

---

## Task 7: `status` command

**Files:**
- Modify: `tools/signapps-installer/src/commands/status.rs`

- [ ] **Step 1: Implement via bollard**

```rust
//! `status` — list SignApps containers and their health via Docker API.

use crate::config;
use anyhow::{Context, Result};
use bollard::container::ListContainersOptions;
use bollard::Docker;
use std::collections::HashMap;
use std::path::PathBuf;

pub async fn run(config_dir: Option<PathBuf>) -> Result<()> {
    let dir = config::resolve_config_dir(config_dir);

    let cfg = config::read_config(&dir)
        .context("read installer config — did you run `init`?")?;

    println!("SignApps — installed {} (version {})", cfg.installed_at.to_rfc3339(), cfg.installed_version);
    if let Some(v) = &cfg.current_version {
        println!("Current version: {v}");
    }
    println!();

    let docker = Docker::connect_with_local_defaults().context("connect to Docker")?;

    let mut filters: HashMap<String, Vec<String>> = HashMap::new();
    filters.insert(
        "label".to_string(),
        vec!["com.docker.compose.project=signapps-prod".to_string()],
    );

    let opts = ListContainersOptions::<String> {
        all: true,
        filters,
        ..Default::default()
    };

    let containers = docker
        .list_containers(Some(opts))
        .await
        .context("list containers")?;

    if containers.is_empty() {
        println!("No SignApps containers running.");
        println!("Start with: signapps-installer start");
        return Ok(());
    }

    let total = containers.len();
    let healthy = containers
        .iter()
        .filter(|c| c.status.as_deref().map(|s| s.contains("(healthy)")).unwrap_or(false))
        .count();

    println!("{}/{} containers healthy", healthy, total);
    println!();

    for c in containers {
        let name = c.names.and_then(|n| n.into_iter().next()).unwrap_or_default();
        let state = c.state.as_deref().unwrap_or("-");
        let status = c.status.as_deref().unwrap_or("-");
        println!("  {name}  {state}  {status}");
    }

    Ok(())
}
```

- [ ] **Step 2: Build**

```
cargo check -p signapps-installer
```

- [ ] **Step 3: Commit**

```bash
rtk git add tools/signapps-installer/src/commands/status.rs
rtk git commit -m "feat(installer): status command lists container health via bollard"
```

---

## Task 8: `backup` command

**Files:**
- Modify: `tools/signapps-installer/src/commands/backup.rs`

- [ ] **Step 1: Implement**

```rust
//! `backup` — pg_dump + volume tarballs into the backups dir.

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

    println!("→ pg_dump → {}", dump_path.display());

    // Run pg_dump inside the postgres container (no local psql client required)
    let dump_cmd = format!(
        "docker exec signapps-postgres pg_dump -U signapps -d signapps | gzip > {}",
        dump_path.to_str().context("path")?
    );

    let status = tokio::process::Command::new("sh")
        .arg("-c")
        .arg(&dump_cmd)
        .status()
        .await
        .context("spawn pg_dump")?;

    if !status.success() {
        bail!("pg_dump failed");
    }

    println!("✓ Backup created at {}", dump_path.display());
    println!();
    println!("Note: this backup covers the Postgres database only.");
    println!("Docker volumes (storage_data, models_data) are NOT included");
    println!("— use `docker run --rm -v <vol>:/data -v $(pwd):/out busybox tar czf /out/<name>.tgz /data`");
    println!("to snapshot them separately.");

    Ok(())
}
```

**Note:** On Windows, `sh -c` may not work out of the box. For a POC, this is acceptable — the on-premise installer is primarily targeted at Linux servers. A Windows fallback can be a Phase 4.1 follow-up.

- [ ] **Step 2: Commit**

```bash
rtk git add tools/signapps-installer/src/commands/backup.rs
rtk git commit -m "feat(installer): backup command runs pg_dump into backups dir"
```

---

## Task 9: Smoke tests

**Files:**
- Create: `tools/signapps-installer/tests/cli_smoke.rs`

- [ ] **Step 1: Tests**

```rust
//! E2E smoke tests for the installer CLI.

use assert_cmd::Command;
use tempfile::TempDir;

#[test]
fn help_lists_all_commands() {
    let mut cmd = Command::cargo_bin("signapps-installer").unwrap();
    let out = cmd.arg("--help").assert().success();
    let text = String::from_utf8_lossy(&out.get_output().stdout).to_string();
    for subcommand in ["init", "start", "stop", "update", "status", "backup"] {
        assert!(text.contains(subcommand), "missing subcommand '{subcommand}' in --help");
    }
}

#[test]
fn version_prints_semver() {
    let mut cmd = Command::cargo_bin("signapps-installer").unwrap();
    let out = cmd.arg("--version").assert().success();
    let text = String::from_utf8_lossy(&out.get_output().stdout).to_string();
    assert!(text.contains(env!("CARGO_PKG_VERSION")));
}

#[test]
fn init_in_tempdir_writes_expected_files() {
    let tmp = TempDir::new().unwrap();
    let dir = tmp.path();

    let mut cmd = Command::cargo_bin("signapps-installer").unwrap();
    cmd.args(["--config-dir", dir.to_str().unwrap(), "init"])
        .assert()
        .success();

    assert!(dir.join("config.toml").exists());
    assert!(dir.join("docker-compose.prod.yml").exists());
    assert!(dir.join(".env").exists());
    assert!(dir.join("backups").is_dir());
    assert!(dir.join("data").is_dir());
}

#[test]
fn init_refuses_existing_without_force() {
    let tmp = TempDir::new().unwrap();
    let dir = tmp.path();

    Command::cargo_bin("signapps-installer")
        .unwrap()
        .args(["--config-dir", dir.to_str().unwrap(), "init"])
        .assert()
        .success();

    Command::cargo_bin("signapps-installer")
        .unwrap()
        .args(["--config-dir", dir.to_str().unwrap(), "init"])
        .assert()
        .failure();
}
```

- [ ] **Step 2: Run**

```
cargo nextest run -p signapps-installer --test cli_smoke
```

Expected: 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
rtk git add tools/signapps-installer/tests/cli_smoke.rs
rtk git commit -m "test(installer): 4 CLI smoke tests (help, version, init, refuse-existing)"
```

---

## Task 10: Install guide for clients

**Files:**
- Create: `docs/onprem/INSTALL.md`

- [ ] **Step 1: Write guide**

```markdown
# SignApps Platform — On-premise Installation Guide

This guide walks you through installing SignApps on your own server using the `signapps-installer` binary.

## Prerequisites

- A Linux server (or Windows with Docker Desktop / WSL2) with :
  - Docker Engine ≥ 24.0 OR Docker Desktop
  - 16 GB RAM minimum (32 GB recommended for the full stack)
  - 50 GB disk
  - Port 80, 443, 3000, 3001-3099, 8095, 8096 free
- A `ghcr.io` pull credential (if the images are private) — ask SignApps support.

## 1. Download the installer

From the release page provided by SignApps, download `signapps-installer-<os>-<arch>`.

```bash
chmod +x signapps-installer
sudo mv signapps-installer /usr/local/bin/
```

## 2. Initialise

```bash
sudo signapps-installer init
```

This creates `/etc/signapps/` with :
- `config.toml` — installer metadata
- `docker-compose.prod.yml` — the service stack
- `.env` — environment file you'll fill in
- `data/` — bind mount for container volumes
- `backups/` — auto-backup destination

## 3. Configure secrets

Edit `/etc/signapps/.env` :

```bash
sudo $EDITOR /etc/signapps/.env
```

Required :
- `POSTGRES_PASSWORD` — generate a strong random value
- `JWT_PRIVATE_KEY_PEM` + `JWT_PUBLIC_KEY_PEM` — generate via `scripts/gen-jwt-keys.sh` (available in the SignApps repo), OR `openssl genrsa -out jwt.pem 4096 && openssl rsa -in jwt.pem -pubout -out jwt.pub.pem`
- `SIGNAPPS_VERSION` — the version to deploy (e.g. `v1.2.3`)

Optional (defaults are sensible) :
- `LDAP_*`, `OAUTH_*`, `GHCR_TOKEN` (if images are private)

## 4. Start

```bash
sudo signapps-installer start
```

Wait ~60 seconds for all containers to become healthy, then :

```bash
sudo signapps-installer status
```

Expected : `33/33 containers healthy`.

## 5. Update

```bash
sudo signapps-installer update --version v1.2.4
```

## 6. Backup

```bash
sudo signapps-installer backup
```

Creates `/etc/signapps/backups/signapps-pg-<timestamp>.sql.gz`.

Restore :

```bash
gunzip -c /etc/signapps/backups/signapps-pg-XXXX.sql.gz | docker exec -i signapps-postgres psql -U signapps -d signapps
```

## 7. Stop

```bash
sudo signapps-installer stop
```

## Troubleshooting

- **"Cannot connect to Docker daemon"** : ensure Docker service is running (`systemctl start docker` on Linux, launch Docker Desktop on Windows/Mac).
- **Port already in use** : check with `ss -tlnp | grep :<port>`. On Windows, the Hyper-V reserved range may claim some ports — use `netsh interface ipv4 show excludedportrange protocol=tcp`.
- **Containers unhealthy** : run `docker logs signapps-<name>-1` to inspect. Share with SignApps support if unsure.

## Getting help

Contact : support@signapps.example
Issue tracker : github.com/your-org/signapps-platform/issues
```

- [ ] **Step 2: Commit**

```bash
rtk git add docs/onprem/INSTALL.md
rtk git commit -m "docs(installer): on-premise installation guide"
```

---

## Task 11: Final validation

- [ ] **Step 1: Quality pipeline**

```bash
cargo fmt -p signapps-installer -- --check
cargo clippy -p signapps-installer --all-features -- -D warnings
cargo nextest run -p signapps-installer
```

Fix any Phase 4 fmt drift with a style commit.

- [ ] **Step 2: Smoke test final**

```bash
cargo run -p signapps-installer -- --help
```

Expected : all 6 commands listed.

```bash
cargo run -p signapps-installer -- --config-dir /tmp/sa-test init
ls /tmp/sa-test/
cat /tmp/sa-test/config.toml
rm -rf /tmp/sa-test
```

- [ ] **Step 3: Tag**

```bash
rtk git tag -a phase4-installer-complete -m "Phase 4: signapps-installer on-premise binary complete"
```

Do NOT push.

---

## Review Checklist

- [ ] Binary `signapps-installer` compiles on Linux + Windows (cross-compile check optional)
- [ ] `--help` lists all 6 commands
- [ ] `init` creates the config directory with all expected files
- [ ] `init` refuses to overwrite without `--force`
- [ ] `start`/`stop` invoke `docker compose up/down` with the correct env file
- [ ] `update --version v1.2.3` sets `SIGNAPPS_VERSION` and recreates containers
- [ ] `status` shows per-container health via bollard
- [ ] `backup` dumps PG to a timestamped `.sql.gz`
- [ ] `docs/onprem/INSTALL.md` written
- [ ] 4 CLI smoke tests pass
- [ ] Binary is **self-contained** (no signapps-common, signapps-db, etc. deps)
- [ ] Tag `phase4-installer-complete` created locally
