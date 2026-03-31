use crate::config::AgentConfig;
use std::sync::Arc;
use tokio::sync::RwLock;

// ─── Patch scan loop — detects and reports available patches ─────────────────

pub async fn patch_scan_loop(config: Arc<RwLock<AgentConfig>>) {
    let client = reqwest::Client::new();
    tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;

    loop {
        let cfg = config.read().await;
        let url = cfg.api_url("/patches/report");
        let token = cfg.jwt_token.clone().unwrap_or_default();
        let agent_id = cfg.agent_id.clone().unwrap_or_default();
        drop(cfg);

        // Collect OS patches
        let mut patches = detect_available_patches().await;

        // Collect 3rd party patches (Chocolatey / Winget / snap)
        let third_party = detect_third_party_patches().await;
        patches.extend(third_party);

        if !patches.is_empty() {
            let _ = client
                .post(&url)
                .bearer_auth(&token)
                .json(&serde_json::json!({
                    "agent_id": agent_id,
                    "patches": patches,
                }))
                .send()
                .await;
            tracing::info!("Reported {} available patches", patches.len());
        }

        // Also check for approved patches and install them
        install_approved_patches(&config).await;

        // Scan every 6 hours
        tokio::time::sleep(tokio::time::Duration::from_secs(6 * 3600)).await;
    }
}

// ─── PA1: Install approved patches ────────────────────────────────────────────
//
// Polls /agent/:id/config for patches with status='deployed',
// executes installation, and reports the result.

pub async fn install_approved_patches(config: &Arc<RwLock<AgentConfig>>) {
    let cfg = config.read().await;
    let agent_id = match &cfg.agent_id {
        Some(id) => id.clone(),
        None => return,
    };
    let config_url = cfg.api_url(&format!("/agent/{}/config", agent_id));
    let token = cfg.jwt_token.clone().unwrap_or_default();
    drop(cfg);

    let client = reqwest::Client::new();

    // Fetch agent config — server includes approved patches in config payload
    let config_resp = match client.get(&config_url).bearer_auth(&token).send().await {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!("Could not fetch agent config for patches: {}", e);
            return;
        },
    };

    let config_data: serde_json::Value = match config_resp.json().await {
        Ok(v) => v,
        Err(_) => return,
    };

    let approved_patches = match config_data["approved_patches"].as_array() {
        Some(p) => p.clone(),
        None => return,
    };

    if approved_patches.is_empty() {
        return;
    }

    tracing::info!("Installing {} approved patches", approved_patches.len());

    for patch in &approved_patches {
        let patch_id = patch["id"].as_str().unwrap_or_default().to_string();
        let patch_title = patch["title"].as_str().unwrap_or("unknown").to_string();
        let category = patch["category"].as_str().unwrap_or("os");

        tracing::info!("Installing patch: {} ({})", patch_title, patch_id);

        let result = if category.starts_with("choco:") {
            let package = category.trim_start_matches("choco:");
            install_chocolatey_package(package).await
        } else if category.starts_with("winget:") {
            let package = category.trim_start_matches("winget:");
            install_winget_package(package).await
        } else {
            install_os_patch(&patch_id).await
        };

        // Report installation result back to server
        let cfg = config.read().await;
        let report_url = cfg.api_url("/patches/install-result");
        let token = cfg.jwt_token.clone().unwrap_or_default();
        drop(cfg);

        let (success, message) = match &result {
            Ok(msg) => (true, msg.clone()),
            Err(e) => (false, e.clone()),
        };

        let _ = client
            .post(&report_url)
            .bearer_auth(&token)
            .json(&serde_json::json!({
                "agent_id": agent_id,
                "patch_id": patch_id,
                "success": success,
                "message": message,
            }))
            .send()
            .await;

        if success {
            tracing::info!("Patch {} installed: {}", patch_id, message);
        } else {
            tracing::warn!("Patch {} failed: {}", patch_id, message);
        }
    }
}

async fn install_os_patch(patch_id: &str) -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        // Extract package name from patch_id (format: apt-<name>-<version>)
        let package_name = patch_id
            .strip_prefix("apt-")
            .and_then(|s| s.rsplit_once('-'))
            .map(|(name, _ver)| name)
            .unwrap_or(patch_id);

        let output = tokio::process::Command::new("apt-get")
            .args(["install", "-y", "--only-upgrade", package_name])
            .env("DEBIAN_FRONTEND", "noninteractive")
            .output()
            .await
            .map_err(|e| format!("Failed to run apt-get: {}", e))?;

        if output.status.success() {
            return Ok(format!("apt-get upgraded {}", package_name));
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("apt-get failed: {}", stderr));
        }
    }

    #[cfg(target_os = "windows")]
    {
        let kb = patch_id.to_string();
        let script = format!(
            r#"
            $Session = New-Object -ComObject Microsoft.Update.Session
            $Searcher = $Session.CreateUpdateSearcher()
            $Results = $Searcher.Search("IsInstalled=0 AND KBArticleIDs='{kb}'")
            if ($Results.Updates.Count -eq 0) {{ Write-Output "Not found"; exit 1 }}
            $Installer = $Session.CreateUpdateInstaller()
            $Installer.Updates = $Results.Updates
            $Result = $Installer.Install()
            Write-Output ("ResultCode=" + $Result.ResultCode)
            "#,
            kb = kb.trim_start_matches("KB")
        );
        let output = tokio::process::Command::new("powershell")
            .args(["-NonInteractive", "-Command", &script])
            .output()
            .await
            .map_err(|e| format!("PowerShell error: {}", e))?;

        if output.status.success() {
            return Ok(String::from_utf8_lossy(&output.stdout).to_string());
        } else {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
    }

    #[allow(unreachable_code)]
    Err(format!(
        "OS patch installation not supported on this platform for {}",
        patch_id
    ))
}

// ─── PA2: 3rd party patching — Chocolatey (Windows) / snap (Linux) ───────────

async fn detect_third_party_patches() -> Vec<serde_json::Value> {
    let mut patches = Vec::new();

    #[cfg(target_os = "windows")]
    {
        let choco_patches = detect_chocolatey_updates().await;
        patches.extend(choco_patches);

        let winget_patches = detect_winget_updates().await;
        patches.extend(winget_patches);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let snap_patches = detect_snap_updates().await;
        patches.extend(snap_patches);
    }

    patches
}

#[cfg(target_os = "windows")]
async fn detect_chocolatey_updates() -> Vec<serde_json::Value> {
    let mut patches = Vec::new();

    // Check if choco is installed
    if tokio::process::Command::new("choco")
        .args(["--version"])
        .output()
        .await
        .is_err()
    {
        return patches;
    }

    // Query outdated packages as JSON
    let output = match tokio::process::Command::new("choco")
        .args(["outdated", "--json"])
        .output()
        .await
    {
        Ok(o) => o,
        Err(_) => return patches,
    };

    if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&output.stdout) {
        if let Some(packages) = json.as_array() {
            for pkg in packages {
                let name = pkg["name"].as_str().unwrap_or("");
                let current = pkg["currentVersion"].as_str().unwrap_or("");
                let available = pkg["availableVersion"].as_str().unwrap_or("");
                if !name.is_empty() && current != available {
                    patches.push(serde_json::json!({
                        "patch_id": format!("choco-{}-{}", name, available),
                        "title": format!("{} {} → {}", name, current, available),
                        "severity": "unknown",
                        "category": format!("choco:{}", name),
                        "source": "chocolatey",
                    }));
                }
            }
        }
    }

    patches
}

#[cfg(target_os = "windows")]
async fn detect_winget_updates() -> Vec<serde_json::Value> {
    let mut patches = Vec::new();

    let output = match tokio::process::Command::new("winget")
        .args(["upgrade", "--include-unknown", "--source", "winget"])
        .output()
        .await
    {
        Ok(o) => o,
        Err(_) => return patches,
    };

    let text = String::from_utf8_lossy(&output.stdout);
    let mut in_table = false;
    for line in text.lines() {
        if line.contains("Name") && line.contains("Id") && line.contains("Version") {
            in_table = true;
            continue;
        }
        if !in_table || line.trim().is_empty() || line.starts_with('-') {
            continue;
        }
        // Split on 2+ spaces to get columns
        let cols: Vec<&str> = line
            .splitn(5, "  ")
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .collect();
        if cols.len() >= 4 {
            let name = cols[0];
            let id = cols[1];
            let current = cols[2];
            let available = cols[3];
            if available != "Unknown" && !available.is_empty() {
                patches.push(serde_json::json!({
                    "patch_id": format!("winget-{}-{}", id, available),
                    "title": format!("{} {} → {}", name, current, available),
                    "severity": "unknown",
                    "category": format!("winget:{}", id),
                    "source": "winget",
                }));
            }
        }
    }

    patches
}

async fn install_chocolatey_package(package: &str) -> Result<String, String> {
    let output = tokio::process::Command::new("choco")
        .args(["upgrade", package, "-y", "--no-progress"])
        .output()
        .await
        .map_err(|e| format!("choco error: {}", e))?;

    if output.status.success() {
        Ok(format!("Chocolatey upgraded {}", package))
    } else {
        Err(format!(
            "choco upgrade failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

async fn install_winget_package(package_id: &str) -> Result<String, String> {
    let output = tokio::process::Command::new("winget")
        .args([
            "upgrade",
            "--id",
            package_id,
            "--silent",
            "--accept-package-agreements",
        ])
        .output()
        .await
        .map_err(|e| format!("winget error: {}", e))?;

    if output.status.success() {
        Ok(format!("winget upgraded {}", package_id))
    } else {
        Err(format!(
            "winget upgrade failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

#[cfg(not(target_os = "windows"))]
async fn detect_snap_updates() -> Vec<serde_json::Value> {
    let mut patches = Vec::new();

    let output = match tokio::process::Command::new("snap")
        .args(["refresh", "--list"])
        .output()
        .await
    {
        Ok(o) => o,
        Err(_) => return patches,
    };

    for line in String::from_utf8_lossy(&output.stdout).lines().skip(1) {
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.len() >= 3 {
            let name = cols[0];
            let version = cols[1];
            patches.push(serde_json::json!({
                "patch_id": format!("snap-{}-{}", name, version),
                "title": format!("snap: {} {}", name, version),
                "severity": "unknown",
                "category": "snap",
                "source": "snap",
            }));
        }
    }

    patches
}

// ─── OS patch detection (existing logic) ────────────────────────────────────

async fn detect_available_patches() -> Vec<serde_json::Value> {
    let mut patches = Vec::new();

    #[cfg(target_os = "linux")]
    {
        if let Ok(output) = tokio::process::Command::new("apt")
            .args(["list", "--upgradable"])
            .output()
            .await
        {
            for line in String::from_utf8_lossy(&output.stdout).lines().skip(1) {
                if let Some(name) = line.split('/').next() {
                    let version = line.split_whitespace().nth(1).unwrap_or("");
                    patches.push(serde_json::json!({
                        "patch_id": format!("apt-{}-{}", name, version),
                        "title": format!("{} {}", name, version),
                        "severity": "unknown",
                        "category": "os",
                    }));
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = tokio::process::Command::new("powershell")
            .args([
                "-Command",
                r#"
                $Session = New-Object -ComObject Microsoft.Update.Session
                $Searcher = $Session.CreateUpdateSearcher()
                $Results = $Searcher.Search("IsInstalled=0")
                $Results.Updates | ForEach-Object {
                    [PSCustomObject]@{
                        Title = $_.Title
                        KBArticleIDs = ($_.KBArticleIDs -join ',')
                        MsrcSeverity = $_.MsrcSeverity
                        MaxDownloadSize = $_.MaxDownloadSize
                    }
                } | ConvertTo-Json
            "#,
            ])
            .output()
            .await
        {
            if let Ok(updates) = serde_json::from_slice::<Vec<serde_json::Value>>(&output.stdout) {
                for u in updates {
                    let title = u["Title"].as_str().unwrap_or("");
                    let kb = u["KBArticleIDs"].as_str().unwrap_or("");
                    let severity = u["MsrcSeverity"].as_str().unwrap_or("unknown");
                    patches.push(serde_json::json!({
                        "patch_id": format!("KB{}", kb),
                        "title": title,
                        "severity": severity.to_lowercase(),
                        "kb_number": format!("KB{}", kb),
                        "category": "os",
                    }));
                }
            }
        }
    }

    // Feature 23: macOS patch detection via softwareupdate --list
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = tokio::process::Command::new("softwareupdate")
            .args(["--list"])
            .output()
            .await
        {
            let text = String::from_utf8_lossy(&output.stdout);
            let mut current_label: Option<String> = None;
            for line in text.lines() {
                let line = line.trim();
                if let Some(rest) = line.strip_prefix("* Label:") {
                    current_label = Some(rest.trim().to_string());
                } else if line.starts_with("Title:") {
                    if let Some(label) = current_label.take() {
                        let title = line
                            .split(',')
                            .next()
                            .unwrap_or("")
                            .trim_start_matches("Title:")
                            .trim()
                            .to_string();
                        let severity = if label.to_lowercase().contains("security") {
                            "critical"
                        } else {
                            "unknown"
                        };
                        patches.push(serde_json::json!({
                            "patch_id": format!("macos-{}", label),
                            "title": if title.is_empty() { label.clone() } else { title },
                            "severity": severity,
                            "category": "os",
                        }));
                    }
                }
            }
        }
    }

    patches
}
