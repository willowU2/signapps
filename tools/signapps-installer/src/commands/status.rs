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

    #[allow(clippy::print_stdout)]
    {
        println!(
            "SignApps — installed {} (version {})",
            cfg.installed_at.to_rfc3339(),
            cfg.installed_version
        );
        if let Some(v) = &cfg.current_version {
            println!("Current version: {v}");
        }
        println!();
    }

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

    #[allow(clippy::print_stdout)]
    {
        if containers.is_empty() {
            println!("No SignApps containers running.");
            println!("Start with: signapps-installer start");
            return Ok(());
        }

        let total = containers.len();
        let healthy = containers
            .iter()
            .filter(|c| {
                c.status
                    .as_deref()
                    .map(|s| s.contains("(healthy)"))
                    .unwrap_or(false)
            })
            .count();

        println!("{}/{} containers healthy", healthy, total);
        println!();

        for c in containers {
            let name = c
                .names
                .and_then(|n| n.into_iter().next())
                .unwrap_or_default();
            let state = c.state.as_deref().unwrap_or("-");
            let status = c.status.as_deref().unwrap_or("-");
            println!("  {name}  {state}  {status}");
        }
    }

    Ok(())
}
