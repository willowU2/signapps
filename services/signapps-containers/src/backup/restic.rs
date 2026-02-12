//! Restic backup client wrapper.

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::process::Command;

/// Restic client for backup operations.
#[derive(Debug, Clone)]
pub struct ResticClient {
    binary: String,
}

/// A restic snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: String,
    pub short_id: String,
    pub time: String,
    pub hostname: String,
    pub paths: Vec<String>,
    pub tags: Option<Vec<String>>,
}

/// Backup summary from restic output.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupSummary {
    pub snapshot_id: String,
    pub files_new: i32,
    pub files_changed: i32,
    pub files_unmodified: i32,
    pub data_added: i64,
    pub total_bytes_processed: i64,
    pub total_duration: f64,
}

/// Parsed restic backup JSON message.
#[derive(Debug, Deserialize)]
struct ResticMessage {
    message_type: String,
    #[serde(default)]
    snapshot_id: Option<String>,
    #[serde(default)]
    files_new: Option<i32>,
    #[serde(default)]
    files_changed: Option<i32>,
    #[serde(default)]
    files_unmodified: Option<i32>,
    #[serde(default)]
    data_added: Option<i64>,
    #[serde(default)]
    total_bytes_processed: Option<i64>,
    #[serde(default)]
    total_duration: Option<f64>,
}

impl ResticClient {
    pub fn new() -> Self {
        Self {
            binary: std::env::var("RESTIC_BINARY").unwrap_or_else(|_| "restic".to_string()),
        }
    }

    /// Build environment variables for a restic command.
    fn build_env(
        &self,
        repo: &str,
        password: &str,
        destination_type: &str,
        destination_config: &serde_json::Value,
    ) -> HashMap<String, String> {
        let mut env = HashMap::new();
        env.insert("RESTIC_REPOSITORY".to_string(), repo.to_string());
        env.insert("RESTIC_PASSWORD".to_string(), password.to_string());

        if destination_type == "s3" {
            if let Some(endpoint) = destination_config.get("endpoint").and_then(|v| v.as_str()) {
                env.insert("AWS_DEFAULT_REGION".to_string(), "us-east-1".to_string());
                // Restic uses s3:endpoint/bucket format
                if let Some(access_key) =
                    destination_config.get("access_key").and_then(|v| v.as_str())
                {
                    env.insert("AWS_ACCESS_KEY_ID".to_string(), access_key.to_string());
                }
                if let Some(secret_key) =
                    destination_config.get("secret_key").and_then(|v| v.as_str())
                {
                    env.insert("AWS_SECRET_ACCESS_KEY".to_string(), secret_key.to_string());
                }
                let _ = endpoint; // used in repo URL construction
            }
        }

        env
    }

    /// Build the repository URL from destination config.
    pub fn build_repo_url(
        destination_type: &str,
        destination_config: &serde_json::Value,
    ) -> String {
        match destination_type {
            "s3" => {
                let endpoint = destination_config
                    .get("endpoint")
                    .and_then(|v| v.as_str())
                    .unwrap_or("s3.amazonaws.com");
                let bucket = destination_config
                    .get("bucket")
                    .and_then(|v| v.as_str())
                    .unwrap_or("backups");
                format!("s3:{endpoint}/{bucket}")
            }
            "sftp" => {
                let host = destination_config
                    .get("host")
                    .and_then(|v| v.as_str())
                    .unwrap_or("localhost");
                let path = destination_config
                    .get("path")
                    .and_then(|v| v.as_str())
                    .unwrap_or("/backups");
                let user = destination_config
                    .get("user")
                    .and_then(|v| v.as_str())
                    .unwrap_or("backup");
                format!("sftp:{user}@{host}:{path}")
            }
            _ => {
                // local
                destination_config
                    .get("path")
                    .and_then(|v| v.as_str())
                    .unwrap_or("/var/backups/signapps")
                    .to_string()
            }
        }
    }

    /// Run a restic command.
    async fn run(
        &self,
        args: &[&str],
        env: &HashMap<String, String>,
    ) -> Result<String> {
        let output = Command::new(&self.binary)
            .args(args)
            .envs(env)
            .output()
            .await
            .context("Failed to run restic")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("restic failed: {}", stderr.trim()));
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    /// Initialize a restic repository.
    pub async fn init(
        &self,
        destination_type: &str,
        destination_config: &serde_json::Value,
        password: &str,
    ) -> Result<()> {
        let repo = Self::build_repo_url(destination_type, destination_config);
        let env = self.build_env(&repo, password, destination_type, destination_config);

        match self.run(&["init", "--json"], &env).await {
            Ok(_) => Ok(()),
            Err(e) => {
                let msg = e.to_string();
                // Already initialized is OK
                if msg.contains("already initialized") || msg.contains("config file already exists")
                {
                    Ok(())
                } else {
                    Err(e)
                }
            }
        }
    }

    /// Run a backup of the given paths.
    pub async fn backup(
        &self,
        destination_type: &str,
        destination_config: &serde_json::Value,
        password: &str,
        paths: &[String],
        tags: &[String],
    ) -> Result<BackupSummary> {
        let repo = Self::build_repo_url(destination_type, destination_config);
        let env = self.build_env(&repo, password, destination_type, destination_config);

        let mut args = vec!["backup", "--json"];
        for tag in tags {
            args.push("--tag");
            args.push(tag);
        }
        for path in paths {
            args.push(path);
        }

        let output = self.run(&args, &env).await?;

        // Parse the JSON output — look for the summary message
        for line in output.lines() {
            if let Ok(msg) = serde_json::from_str::<ResticMessage>(line) {
                if msg.message_type == "summary" {
                    return Ok(BackupSummary {
                        snapshot_id: msg.snapshot_id.unwrap_or_default(),
                        files_new: msg.files_new.unwrap_or(0),
                        files_changed: msg.files_changed.unwrap_or(0),
                        files_unmodified: msg.files_unmodified.unwrap_or(0),
                        data_added: msg.data_added.unwrap_or(0),
                        total_bytes_processed: msg.total_bytes_processed.unwrap_or(0),
                        total_duration: msg.total_duration.unwrap_or(0.0),
                    });
                }
            }
        }

        Err(anyhow!("No summary found in restic backup output"))
    }

    /// List snapshots.
    pub async fn snapshots(
        &self,
        destination_type: &str,
        destination_config: &serde_json::Value,
        password: &str,
    ) -> Result<Vec<Snapshot>> {
        let repo = Self::build_repo_url(destination_type, destination_config);
        let env = self.build_env(&repo, password, destination_type, destination_config);

        let output = self.run(&["snapshots", "--json"], &env).await?;
        let snapshots: Vec<Snapshot> =
            serde_json::from_str(&output).context("Failed to parse snapshots")?;

        Ok(snapshots)
    }

    /// Restore a snapshot to a target path.
    pub async fn restore(
        &self,
        destination_type: &str,
        destination_config: &serde_json::Value,
        password: &str,
        snapshot_id: &str,
        target: &str,
    ) -> Result<()> {
        let repo = Self::build_repo_url(destination_type, destination_config);
        let env = self.build_env(&repo, password, destination_type, destination_config);

        self.run(&["restore", snapshot_id, "--target", target], &env)
            .await?;

        Ok(())
    }

    /// Apply retention policy (forget + prune).
    pub async fn forget(
        &self,
        destination_type: &str,
        destination_config: &serde_json::Value,
        password: &str,
        keep_last: Option<i32>,
        keep_daily: Option<i32>,
        keep_weekly: Option<i32>,
        keep_monthly: Option<i32>,
    ) -> Result<()> {
        let repo = Self::build_repo_url(destination_type, destination_config);
        let env = self.build_env(&repo, password, destination_type, destination_config);

        let mut args = vec!["forget", "--prune"];

        let keep_last_str;
        if let Some(n) = keep_last {
            keep_last_str = n.to_string();
            args.push("--keep-last");
            args.push(&keep_last_str);
        }
        let keep_daily_str;
        if let Some(n) = keep_daily {
            keep_daily_str = n.to_string();
            args.push("--keep-daily");
            args.push(&keep_daily_str);
        }
        let keep_weekly_str;
        if let Some(n) = keep_weekly {
            keep_weekly_str = n.to_string();
            args.push("--keep-weekly");
            args.push(&keep_weekly_str);
        }
        let keep_monthly_str;
        if let Some(n) = keep_monthly {
            keep_monthly_str = n.to_string();
            args.push("--keep-monthly");
            args.push(&keep_monthly_str);
        }

        self.run(&args, &env).await?;

        Ok(())
    }
}
