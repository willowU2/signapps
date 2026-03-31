use crate::config::AgentConfig;
use std::sync::Arc;
use sysinfo::{Disks, System};
use tokio::sync::RwLock;

pub async fn inventory_loop(config: Arc<RwLock<AgentConfig>>) {
    let client = reqwest::Client::new();

    // Initial delay before first inventory
    tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;

    loop {
        let cfg = config.read().await;
        let interval = cfg.inventory_interval_secs;
        let agent_id = cfg.agent_id.clone().unwrap_or_default();
        let hw_url = cfg.api_url(&format!("/agent/{}/hardware-inventory", agent_id));
        let sw_url = cfg.api_url(&format!("/agent/{}/software-inventory", agent_id));
        let token = cfg.jwt_token.clone().unwrap_or_default();
        drop(cfg);

        // Hardware inventory
        let mut sys = System::new_all();
        sys.refresh_all();

        let cpus: Vec<serde_json::Value> = sys
            .cpus()
            .iter()
            .take(1)
            .map(|cpu| {
                serde_json::json!({
                    "name": cpu.brand(),
                    "cores": sys.cpus().len(),
                    "frequency_mhz": cpu.frequency(),
                })
            })
            .collect();

        let disks_info = Disks::new_with_refreshed_list();
        let disks: Vec<serde_json::Value> = disks_info
            .iter()
            .map(|d| {
                serde_json::json!({
                    "name": d.name().to_string_lossy(),
                    "mount_point": d.mount_point().to_string_lossy(),
                    "total_bytes": d.total_space(),
                    "available_bytes": d.available_space(),
                    "file_system": String::from_utf8_lossy(d.file_system().as_encoded_bytes()),
                })
            })
            .collect();

        let hw_body = serde_json::json!({
            "cpus": cpus,
            "ram_total_bytes": sys.total_memory(),
            "ram_used_bytes": sys.used_memory(),
            "disks": disks,
            "os_name": System::name().unwrap_or_default(),
            "os_version": System::os_version().unwrap_or_default(),
            "hostname": System::host_name().unwrap_or_default(),
        });

        if let Err(e) = client
            .post(&hw_url)
            .bearer_auth(&token)
            .json(&hw_body)
            .send()
            .await
        {
            tracing::warn!("Hardware inventory failed: {}", e);
        } else {
            tracing::info!("Hardware inventory reported");
        }

        // Software inventory
        let software = collect_software();
        if !software.is_empty() {
            if let Err(e) = client
                .post(&sw_url)
                .bearer_auth(&token)
                .json(&serde_json::json!({ "software": software }))
                .send()
                .await
            {
                tracing::warn!("Software inventory failed: {}", e);
            } else {
                tracing::info!("Software inventory reported: {} apps", software.len());
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(interval)).await;
    }
}

fn collect_software() -> Vec<serde_json::Value> {
    let mut apps = Vec::new();

    #[cfg(target_os = "windows")]
    {
        // Read from Windows Registry
        if let Ok(output) = std::process::Command::new("powershell")
            .args(["-Command", r#"Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* | Select-Object DisplayName, DisplayVersion, Publisher, InstallDate | ConvertTo-Json"#])
            .output()
        {
            if let Ok(json) =
                serde_json::from_slice::<Vec<serde_json::Value>>(&output.stdout)
            {
                for item in json {
                    if let Some(name) = item["DisplayName"].as_str() {
                        if !name.is_empty() {
                            apps.push(serde_json::json!({
                                "name": name,
                                "version": item["DisplayVersion"].as_str().unwrap_or(""),
                                "publisher": item["Publisher"].as_str().unwrap_or(""),
                            }));
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Try dpkg first, then rpm
        if let Ok(output) = std::process::Command::new("dpkg-query")
            .args(["-W", "-f", "${Package}\t${Version}\n"])
            .output()
        {
            for line in String::from_utf8_lossy(&output.stdout).lines() {
                let parts: Vec<&str> = line.splitn(2, '\t').collect();
                if parts.len() == 2 {
                    apps.push(serde_json::json!({
                        "name": parts[0],
                        "version": parts[1],
                        "publisher": "",
                    }));
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(entries) = std::fs::read_dir("/Applications") {
            for entry in entries.flatten() {
                let name = entry
                    .file_name()
                    .to_string_lossy()
                    .replace(".app", "")
                    .to_string();
                apps.push(serde_json::json!({
                    "name": name,
                    "version": "",
                    "publisher": "",
                }));
            }
        }
    }

    apps
}
