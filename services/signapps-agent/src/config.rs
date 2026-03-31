use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub agent_id: Option<String>,
    pub server_url: Option<String>,
    pub jwt_token: Option<String>,
    pub poll_interval_secs: u64,
    pub heartbeat_interval_secs: u64,
    pub inventory_interval_secs: u64,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            agent_id: None,
            server_url: None,
            jwt_token: None,
            poll_interval_secs: 60,
            heartbeat_interval_secs: 30,
            inventory_interval_secs: 300,
        }
    }
}

impl AgentConfig {
    pub fn config_path() -> PathBuf {
        let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
        base.join("signapps-agent").join("config.json")
    }

    pub fn load() -> anyhow::Result<Self> {
        let path = Self::config_path();
        if path.exists() {
            let data = std::fs::read_to_string(&path)?;
            Ok(serde_json::from_str(&data)?)
        } else {
            Ok(Self::default())
        }
    }

    pub fn save(&self) -> anyhow::Result<()> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&path, serde_json::to_string_pretty(self)?)?;
        Ok(())
    }

    pub fn api_url(&self, path: &str) -> String {
        format!(
            "{}/api/v1/it-assets{}",
            self.server_url
                .as_deref()
                .unwrap_or("http://localhost:3015"),
            path
        )
    }
}

pub async fn enroll(server: &str, token: &str) -> anyhow::Result<()> {
    let hostname = sysinfo::System::host_name().unwrap_or_else(|| "unknown".into());
    let os_info = sysinfo::System::long_os_version().unwrap_or_else(|| "unknown".into());

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/api/v1/it-assets/agent/register", server))
        .json(&serde_json::json!({
            "hostname": hostname,
            "os_type": std::env::consts::OS,
            "os_version": os_info,
            "enrollment_token": token,
        }))
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    let agent_id = resp["agent_id"].as_str().unwrap_or("").to_string();
    let jwt = resp["token"].as_str().unwrap_or("").to_string();

    let mut config = AgentConfig::load()?;
    config.agent_id = Some(agent_id);
    config.server_url = Some(server.to_string());
    config.jwt_token = Some(jwt);
    config.save()?;

    tracing::info!("Enrolled as {}", config.agent_id.as_deref().unwrap_or("?"));
    Ok(())
}
