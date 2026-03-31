use crate::config::AgentConfig;
use std::sync::Arc;
use sysinfo::System;
use tokio::sync::RwLock;

pub async fn heartbeat_loop(config: Arc<RwLock<AgentConfig>>) {
    let mut sys = System::new_all();
    let client = reqwest::Client::new();

    loop {
        let cfg = config.read().await;
        let interval = cfg.heartbeat_interval_secs;
        let agent_id = cfg.agent_id.clone().unwrap_or_default();
        let url = cfg.api_url(&format!("/agent/{}/heartbeat", agent_id));
        let token = cfg.jwt_token.clone().unwrap_or_default();
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

        let body = serde_json::json!({
            "cpu_usage": cpu_usage,
            "memory_usage": mem_pct,
            "disk_usage": disk_usage,
            "uptime_seconds": uptime,
        });

        match client
            .post(&url)
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
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
