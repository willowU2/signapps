// Feature 24: Process/service monitoring
// Reports running OS services to the server periodically.

use crate::config::AgentConfig;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, serde::Serialize, Clone)]
pub struct ServiceEntry {
    pub name: String,
    pub status: String, // "running" | "stopped" | "unknown"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
}

pub async fn services_monitor_loop(config: Arc<RwLock<AgentConfig>>) {
    let client = reqwest::Client::new();
    // Initial delay to spread load after startup
    tokio::time::sleep(tokio::time::Duration::from_secs(90)).await;

    loop {
        let cfg = config.read().await;
        let agent_id = cfg.agent_id.clone().unwrap_or_default();
        let url = cfg.api_url(&format!("/agent/{}/services", agent_id));
        let token = cfg.jwt_token.clone().unwrap_or_default();
        drop(cfg);

        let services = collect_services().await;
        if !services.is_empty() {
            match client
                .post(&url)
                .bearer_auth(&token)
                .json(&serde_json::json!({ "services": services }))
                .send()
                .await
            {
                Ok(resp) if resp.status().is_success() => {
                    tracing::debug!("Reported {} services", services.len());
                },
                Ok(resp) => tracing::warn!("Service report response: {}", resp.status()),
                Err(e) => tracing::warn!("Service report failed: {}", e),
            }
        }

        // Report every 5 minutes
        tokio::time::sleep(tokio::time::Duration::from_secs(5 * 60)).await;
    }
}

async fn collect_services() -> Vec<ServiceEntry> {
    let mut services = Vec::new();

    #[cfg(target_os = "windows")]
    {
        // sc query type= all returns all services
        if let Ok(output) = tokio::process::Command::new("sc")
            .args(["query", "type=", "all", "state=", "all"])
            .output()
            .await
        {
            let text = String::from_utf8_lossy(&output.stdout);
            // Parse sc query output blocks
            let mut current_name: Option<String> = None;
            let mut current_status: Option<String> = None;
            let mut current_pid: Option<u32> = None;

            for line in text.lines() {
                let line = line.trim();
                if let Some(rest) = line.strip_prefix("SERVICE_NAME:") {
                    // Flush previous entry
                    if let Some(name) = current_name.take() {
                        services.push(ServiceEntry {
                            name,
                            status: current_status.take().unwrap_or_else(|| "unknown".into()),
                            description: None,
                            pid: current_pid.take(),
                        });
                    }
                    current_name = Some(rest.trim().to_string());
                } else if line.contains("STATE") && line.contains(':') {
                    // E.g.: "STATE              : 4  RUNNING"
                    if line.contains("RUNNING") {
                        current_status = Some("running".into());
                    } else if line.contains("STOPPED") {
                        current_status = Some("stopped".into());
                    } else if line.contains("PAUSED") {
                        current_status = Some("paused".into());
                    } else {
                        current_status = Some("unknown".into());
                    }
                } else if line.starts_with("PID") {
                    if let Some(pid_str) = line.split(':').nth(1) {
                        current_pid = pid_str.trim().parse::<u32>().ok();
                    }
                }
            }
            // Flush last entry
            if let Some(name) = current_name.take() {
                services.push(ServiceEntry {
                    name,
                    status: current_status.unwrap_or_else(|| "unknown".into()),
                    description: None,
                    pid: current_pid,
                });
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // systemctl list-units --type=service --all --no-pager --no-legend
        if let Ok(output) = tokio::process::Command::new("systemctl")
            .args([
                "list-units",
                "--type=service",
                "--all",
                "--no-pager",
                "--no-legend",
                "--output=json",
            ])
            .output()
            .await
        {
            if let Ok(units) = serde_json::from_slice::<Vec<serde_json::Value>>(&output.stdout) {
                for unit in units {
                    let name = unit["unit"].as_str().unwrap_or("").to_string();
                    let active = unit["active"].as_str().unwrap_or("unknown");
                    let status = if active == "active" {
                        "running"
                    } else {
                        "stopped"
                    };
                    let description = unit["description"].as_str().map(|s| s.to_string());
                    if !name.is_empty() {
                        services.push(ServiceEntry {
                            name,
                            status: status.into(),
                            description,
                            pid: None,
                        });
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // launchctl list returns PID, Status, Label
        if let Ok(output) = tokio::process::Command::new("launchctl")
            .args(["list"])
            .output()
            .await
        {
            for line in String::from_utf8_lossy(&output.stdout).lines().skip(1) {
                let cols: Vec<&str> = line.split('\t').collect();
                if cols.len() >= 3 {
                    let pid_str = cols[0];
                    let label = cols[2].to_string();
                    let (pid, status) = if pid_str == "-" {
                        (None, "stopped".to_string())
                    } else {
                        (pid_str.parse::<u32>().ok(), "running".to_string())
                    };
                    services.push(ServiceEntry {
                        name: label,
                        status,
                        description: None,
                        pid,
                    });
                }
            }
        }
    }

    services
}
