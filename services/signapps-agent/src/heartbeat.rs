// Heartbeat loop — reports metrics + bandwidth (Feature 28), triggers auto-update (Feature 22).

use crate::config::AgentConfig;
use std::sync::Arc;
use sysinfo::{Networks, System};
use tokio::sync::RwLock;

/// Current agent version (must match Cargo.toml)
const AGENT_VERSION: &str = env!("CARGO_PKG_VERSION");

pub async fn heartbeat_loop(config: Arc<RwLock<AgentConfig>>) {
    let mut sys = System::new_all();
    let client = reqwest::Client::new();

    loop {
        let cfg = config.read().await;
        let interval = cfg.heartbeat_interval_secs;
        let agent_id = cfg.agent_id.clone().unwrap_or_default();
        let url = cfg.api_url(&format!("/agent/{}/heartbeat", agent_id));
        let token = cfg.jwt_token.clone().unwrap_or_default();
        let server_url = cfg.server_url.clone().unwrap_or_default();
        drop(cfg);

        sys.refresh_all();

        let cpu_usage = sys.global_cpu_usage();
        let total_mem = sys.total_memory();
        let used_mem = sys.used_memory();
        let mem_pct = if total_mem > 0 {
            (used_mem as f64 / total_mem as f64) * 100.0
        } else {
            0.0
        };

        let disk_usage = {
            let disks = sysinfo::Disks::new_with_refreshed_list();
            let total: u64 = disks.iter().map(|d| d.total_space()).sum();
            let avail: u64 = disks.iter().map(|d| d.available_space()).sum();
            if total > 0 {
                ((total - avail) as f64 / total as f64) * 100.0
            } else {
                0.0
            }
        };

        let uptime = System::uptime();

        // Feature 28: Network traffic stats
        let network_stats = {
            let networks = Networks::new_with_refreshed_list();
            let mut interfaces = Vec::new();
            for (name, data) in &networks {
                interfaces.push(serde_json::json!({
                    "interface": name,
                    "bytes_sent": data.total_transmitted(),
                    "bytes_received": data.total_received(),
                    "packets_sent": data.total_packets_transmitted(),
                    "packets_received": data.total_packets_received(),
                }));
            }
            interfaces
        };

        let body = serde_json::json!({
            "cpu_usage": cpu_usage,
            "memory_usage": mem_pct,
            "disk_usage": disk_usage,
            "uptime_seconds": uptime,
            "agent_version": AGENT_VERSION,
            "network_interfaces": network_stats,
        });

        match client
            .post(&url)
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                // Parse response to check for auto-update signal (Feature 22)
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    let latest = json
                        .get("agent_latest_version")
                        .and_then(|v| v.as_str())
                        .unwrap_or(AGENT_VERSION);

                    if should_update(AGENT_VERSION, latest) {
                        tracing::info!("Auto-update available: {} → {}", AGENT_VERSION, latest);
                        if let Err(e) =
                            perform_auto_update(&client, &server_url, &token, latest).await
                        {
                            tracing::warn!("Auto-update failed: {}", e);
                        }
                    }
                }
                tracing::debug!(
                    "Heartbeat OK — CPU: {:.1}%, MEM: {:.1}%, DISK: {:.1}%",
                    cpu_usage,
                    mem_pct,
                    disk_usage
                );
            },
            Ok(resp) => tracing::warn!("Heartbeat response: {}", resp.status()),
            Err(e) => tracing::warn!("Heartbeat failed: {}", e),
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(interval)).await;
    }
}

/// Returns true if `latest` is strictly newer than `current` using semver ordering.
fn should_update(current: &str, latest: &str) -> bool {
    if current == latest {
        return false;
    }
    // Simple 3-part semver comparison: major.minor.patch
    let parse = |v: &str| -> (u32, u32, u32) {
        let parts: Vec<u32> = v.split('.').filter_map(|p| p.parse().ok()).collect();
        (
            parts.first().copied().unwrap_or(0),
            parts.get(1).copied().unwrap_or(0),
            parts.get(2).copied().unwrap_or(0),
        )
    };
    parse(latest) > parse(current)
}

/// Feature 22: Download new agent binary and schedule a self-replacement.
async fn perform_auto_update(
    client: &reqwest::Client,
    server_url: &str,
    token: &str,
    new_version: &str,
) -> anyhow::Result<()> {
    let platform = std::env::consts::OS; // "windows" | "linux" | "macos"
    let download_url = format!(
        "{}/api/v1/it-assets/agent/download/{}",
        server_url, platform
    );

    let resp = client.get(&download_url).bearer_auth(token).send().await?;

    if !resp.status().is_success() {
        anyhow::bail!("Download endpoint returned {}", resp.status());
    }

    let bytes = resp.bytes().await?;
    let tmp_dir = std::env::temp_dir();

    #[cfg(target_os = "windows")]
    {
        // Write new binary to temp location
        let new_exe = tmp_dir.join("signapps-agent-new.exe");
        tokio::fs::write(&new_exe, &bytes).await?;

        // Create update batch script — runs after agent exits
        let current_exe = std::env::current_exe()?;
        let script = format!(
            "@echo off\r\n\
             timeout /t 2 /nobreak >nul\r\n\
             copy /y \"{}\" \"{}\" >nul\r\n\
             del \"{}\" >nul\r\n\
             sc start signapps-agent\r\n",
            new_exe.display(),
            current_exe.display(),
            new_exe.display(),
        );
        let bat_path = tmp_dir.join("signapps-agent-update.bat");
        tokio::fs::write(&bat_path, script).await?;

        // Launch batch script detached, then exit so the copy can proceed
        tokio::process::Command::new("cmd")
            .args(["/C", &bat_path.to_string_lossy()])
            .spawn()?;

        tracing::info!(
            "Auto-update to {} scheduled via batch script — restarting…",
            new_version
        );
        std::process::exit(0);
    }

    #[cfg(target_os = "linux")]
    {
        let new_bin = tmp_dir.join("signapps-agent-new");
        tokio::fs::write(&new_bin, &bytes).await?;

        // Make executable
        use std::os::unix::fs::PermissionsExt;
        tokio::fs::set_permissions(&new_bin, std::fs::Permissions::from_mode(0o755)).await?;

        let current_exe = std::env::current_exe()?;
        tokio::fs::copy(&new_bin, &current_exe).await?;
        tokio::fs::remove_file(&new_bin).await.ok();

        tracing::info!(
            "Auto-update to {} complete — restarting via systemd…",
            new_version
        );
        // Restart via systemctl (systemd will respawn the service)
        tokio::process::Command::new("systemctl")
            .args(["restart", "signapps-agent"])
            .spawn()?;
        std::process::exit(0);
    }

    #[cfg(target_os = "macos")]
    {
        let new_bin = tmp_dir.join("signapps-agent-new");
        tokio::fs::write(&new_bin, &bytes).await?;

        use std::os::unix::fs::PermissionsExt;
        tokio::fs::set_permissions(&new_bin, std::fs::Permissions::from_mode(0o755)).await?;

        let current_exe = std::env::current_exe()?;
        tokio::fs::copy(&new_bin, &current_exe).await?;
        tokio::fs::remove_file(&new_bin).await.ok();

        tracing::info!(
            "Auto-update to {} complete — reloading launchd…",
            new_version
        );
        tokio::process::Command::new("launchctl")
            .args(["stop", "com.signapps.agent"])
            .spawn()?;
        std::process::exit(0);
    }

    #[allow(unreachable_code)]
    Ok(())
}
