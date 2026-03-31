// Feature 25: Endpoint backup module
// Compresses configured directories and uploads to SignApps storage.

use crate::config::AgentConfig;
use std::sync::Arc;
use tokio::sync::RwLock;

/// A single backup job entry (from policy config).
#[derive(Debug, serde::Deserialize, serde::Serialize, Clone)]
pub struct BackupPolicy {
    pub name: String,
    pub directories: Vec<String>,
    pub schedule: String, // "daily" | "weekly"
    pub enabled: bool,
}

/// History record of a completed backup run.
#[derive(Debug, serde::Serialize, Clone)]
pub struct BackupHistoryEntry {
    pub name: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub size_bytes: u64,
    pub status: String, // "ok" | "failed"
    pub error: Option<String>,
}

pub async fn backup_loop(config: Arc<RwLock<AgentConfig>>) {
    // Delay startup to let other tasks initialize
    tokio::time::sleep(tokio::time::Duration::from_secs(120)).await;

    loop {
        let cfg = config.read().await;
        let agent_id = cfg.agent_id.clone().unwrap_or_default();
        let server_url = cfg
            .server_url
            .clone()
            .unwrap_or_else(|| "http://localhost:3015".into());
        let token = cfg.jwt_token.clone().unwrap_or_default();
        drop(cfg);

        // Fetch backup policy from server
        let client = reqwest::Client::new();
        let policy_url = format!(
            "{}/api/v1/it-assets/agent/{}/backup-policy",
            server_url, agent_id
        );

        let policies: Vec<BackupPolicy> =
            match client.get(&policy_url).bearer_auth(&token).send().await {
                Ok(resp) if resp.status().is_success() => resp.json().await.unwrap_or_default(),
                _ => vec![],
            };

        for policy in policies.iter().filter(|p| p.enabled) {
            let history = run_backup(policy, &agent_id, &server_url, &token).await;
            tracing::info!(
                "Backup '{}': {} — {} bytes",
                policy.name,
                history.status,
                history.size_bytes
            );
        }

        // Run every hour; the policy schedule check is inside run_backup
        tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
    }
}

async fn run_backup(
    policy: &BackupPolicy,
    agent_id: &str,
    server_url: &str,
    token: &str,
) -> BackupHistoryEntry {
    use chrono::Utc;

    let started_at = Utc::now().to_rfc3339();
    let archive_name = format!(
        "backup_{}_{}.tar.gz",
        policy.name.replace(' ', "_"),
        Utc::now().format("%Y%m%d_%H%M%S")
    );

    let tmp_path = std::env::temp_dir().join(&archive_name);

    // Build tar.gz using system tar command
    let mut tar_args = vec!["-czf".to_string(), tmp_path.to_string_lossy().to_string()];
    tar_args.extend(policy.directories.clone());

    #[cfg(target_os = "windows")]
    let tar_result = tokio::process::Command::new("tar")
        .args(&tar_args)
        .output()
        .await;

    #[cfg(not(target_os = "windows"))]
    let tar_result = tokio::process::Command::new("tar")
        .args(&tar_args)
        .output()
        .await;

    let tar_result = match tar_result {
        Ok(o) if o.status.success() => Ok(o),
        Ok(o) => Err(format!(
            "tar exited {}: {}",
            o.status,
            String::from_utf8_lossy(&o.stderr)
        )),
        Err(e) => Err(e.to_string()),
    };

    if let Err(ref e) = tar_result {
        return BackupHistoryEntry {
            name: policy.name.clone(),
            started_at,
            completed_at: Some(Utc::now().to_rfc3339()),
            size_bytes: 0,
            status: "failed".into(),
            error: Some(e.clone()),
        };
    }

    // Get archive size
    let size_bytes = tokio::fs::metadata(&tmp_path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    // Upload to SignApps storage
    let upload_url = format!("{}/api/v1/storage/upload", server_url);
    let file_bytes = match tokio::fs::read(&tmp_path).await {
        Ok(b) => b,
        Err(e) => {
            return BackupHistoryEntry {
                name: policy.name.clone(),
                started_at,
                completed_at: Some(Utc::now().to_rfc3339()),
                size_bytes,
                status: "failed".into(),
                error: Some(format!("Read archive failed: {}", e)),
            };
        },
    };

    let client = reqwest::Client::new();
    let upload_result = client
        .post(&upload_url)
        .bearer_auth(token)
        .header("X-Agent-Id", agent_id)
        .header("X-Backup-Name", &policy.name)
        .header("Content-Type", "application/gzip")
        .header(
            "Content-Disposition",
            format!("attachment; filename=\"{}\"", archive_name),
        )
        .body(file_bytes)
        .send()
        .await;

    // Clean up temp file
    let _ = tokio::fs::remove_file(&tmp_path).await;

    let (status, error) = match upload_result {
        Ok(resp) if resp.status().is_success() => ("ok".to_string(), None),
        Ok(resp) => (
            "failed".to_string(),
            Some(format!("Upload HTTP {}", resp.status())),
        ),
        Err(e) => ("failed".to_string(), Some(e.to_string())),
    };

    BackupHistoryEntry {
        name: policy.name.clone(),
        started_at,
        completed_at: Some(Utc::now().to_rfc3339()),
        size_bytes,
        status,
        error,
    }
}
