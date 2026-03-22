//! # Slack/Teams Bridge System
//!
//! Manages integrations with external messaging platforms (Slack, Microsoft Teams)
//! to bridge notifications and messages between SignApps and external channels.
//!
//! ## Configuration
//!
//! Each bridge requires:
//! - A unique ID
//! - Source platform (Slack or Teams)
//! - Webhook URL for the external platform
//! - Channel mapping (internal channel → external channel ID)
//! - Enable/disable flag
//!
//! ## Usage
//!
//! ```rust,ignore
//! use signapps_common::bridge::{BridgeConfig, BridgeSource, BridgeManager};
//! use std::collections::HashMap;
//! use uuid::Uuid;
//!
//! let manager = BridgeManager::new();
//!
//! let mut channels = HashMap::new();
//! channels.insert("notifications".to_string(), "C12345ABCDE".to_string());
//!
//! let config = BridgeConfig::new(
//!     BridgeSource::Slack,
//!     "https://hooks.slack.com/services/T00000/B00000/XXXX".to_string(),
//!     channels,
//! );
//!
//! manager.register(config).await;
//! manager.send_to_external(BridgeSource::Slack, "notifications", "Hello!").await;
//! ```

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};
use uuid::Uuid;

/// Source messaging platform for bridge integration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum BridgeSource {
    /// Slack messaging platform
    Slack,
    /// Microsoft Teams messaging platform
    MicrosoftTeams,
}

impl std::fmt::Display for BridgeSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Slack => write!(f, "Slack"),
            Self::MicrosoftTeams => write!(f, "MicrosoftTeams"),
        }
    }
}

/// Configuration for a bridge to an external messaging platform.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeConfig {
    /// Unique identifier for this bridge.
    pub id: Uuid,
    /// Source messaging platform (Slack or Teams).
    pub source: BridgeSource,
    /// Webhook URL for sending messages to the external platform.
    pub webhook_url: String,
    /// Mapping from internal channel name to external channel ID.
    pub channel_mapping: HashMap<String, String>,
    /// Whether this bridge is active.
    pub enabled: bool,
    /// Timestamp when this bridge was created.
    pub created_at: DateTime<Utc>,
}

impl BridgeConfig {
    /// Create a new enabled bridge configuration.
    pub fn new(
        source: BridgeSource,
        webhook_url: String,
        channel_mapping: HashMap<String, String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            source,
            webhook_url,
            channel_mapping,
            enabled: true,
            created_at: Utc::now(),
        }
    }
}

/// In-memory bridge manager.
///
/// Thread-safe via `Arc<RwLock<_>>` internals; cheap to clone.
#[derive(Debug, Clone, Default)]
pub struct BridgeManager {
    configs: Arc<RwLock<Vec<BridgeConfig>>>,
    client: Arc<reqwest::Client>,
}

impl BridgeManager {
    /// Create a new `BridgeManager` with a shared HTTP client.
    pub fn new() -> Self {
        Self {
            configs: Arc::new(RwLock::new(Vec::new())),
            client: Arc::new(reqwest::Client::new()),
        }
    }

    /// Register a new bridge. Returns the assigned [`Uuid`].
    pub async fn register(&self, config: BridgeConfig) -> Uuid {
        let id = config.id;
        let source = config.source;
        info!(
            bridge_id = %id,
            source = %source,
            webhook_url = %config.webhook_url,
            "Registering bridge"
        );
        self.configs.write().await.push(config);
        id
    }

    /// Unregister a bridge by its ID. Returns `true` if it was found and removed.
    pub async fn unregister(&self, id: Uuid) -> bool {
        let mut configs = self.configs.write().await;
        let before = configs.len();
        configs.retain(|c| c.id != id);
        let removed = configs.len() < before;
        if removed {
            info!(bridge_id = %id, "Bridge unregistered");
        } else {
            warn!(bridge_id = %id, "Bridge not found for unregister");
        }
        removed
    }

    /// List all registered bridges (cloned snapshot).
    pub async fn list(&self) -> Vec<BridgeConfig> {
        self.configs.read().await.clone()
    }

    /// Send a message to an external channel via the specified bridge source.
    ///
    /// Looks up the internal channel name in the bridge's channel mapping
    /// and sends the message to the corresponding external channel.
    /// Returns `true` if delivery succeeded, `false` otherwise.
    pub async fn send_to_external(
        &self,
        source: BridgeSource,
        channel: &str,
        message: &str,
    ) -> bool {
        let configs = self.configs.read().await.clone();

        // Find a matching, enabled bridge for this source
        let bridge = match configs.iter().find(|c| c.enabled && c.source == source) {
            Some(b) => b,
            None => {
                warn!(
                    source = %source,
                    channel,
                    "No enabled bridge found for source"
                );
                return false;
            }
        };

        // Look up the external channel ID
        let external_channel = match bridge.channel_mapping.get(channel) {
            Some(ch) => ch,
            None => {
                warn!(
                    source = %source,
                    channel,
                    bridge_id = %bridge.id,
                    "Channel not mapped in bridge"
                );
                return false;
            }
        };

        // Send the message via HTTP POST
        self.send_message(bridge, external_channel, message).await
    }

    // ── Private ──────────────────────────────────────────────────────────────

    async fn send_message(&self, bridge: &BridgeConfig, channel: &str, message: &str) -> bool {
        let payload = serde_json::json!({
            "channel": channel,
            "text": message,
        });

        let result = self
            .client
            .post(&bridge.webhook_url)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await;

        match result {
            Ok(resp) => {
                if resp.status().is_success() {
                    info!(
                        bridge_id = %bridge.id,
                        source = %bridge.source,
                        channel,
                        status = %resp.status(),
                        "Message sent successfully to external platform"
                    );
                    true
                } else {
                    warn!(
                        bridge_id = %bridge.id,
                        source = %bridge.source,
                        channel,
                        status = %resp.status(),
                        "External platform returned non-2xx status"
                    );
                    false
                }
            }
            Err(err) => {
                error!(
                    bridge_id = %bridge.id,
                    source = %bridge.source,
                    channel,
                    error = %err,
                    "Failed to send message to external platform"
                );
                false
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bridge_source_display() {
        assert_eq!(BridgeSource::Slack.to_string(), "Slack");
        assert_eq!(BridgeSource::MicrosoftTeams.to_string(), "MicrosoftTeams");
    }

    #[tokio::test]
    async fn register_and_list() {
        let manager = BridgeManager::new();
        let mut channels = HashMap::new();
        channels.insert("general".to_string(), "C123".to_string());

        let config = BridgeConfig::new(
            BridgeSource::Slack,
            "https://hooks.slack.com/services/T00000/B00000/XXXX".to_string(),
            channels,
        );
        let id = manager.register(config).await;

        let list = manager.list().await;
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, id);
        assert_eq!(list[0].source, BridgeSource::Slack);
    }

    #[tokio::test]
    async fn unregister_removes_bridge() {
        let manager = BridgeManager::new();
        let channels = HashMap::new();

        let config = BridgeConfig::new(
            BridgeSource::MicrosoftTeams,
            "https://outlook.webhook.office.com/webhookb2/xxx".to_string(),
            channels,
        );
        let id = manager.register(config).await;

        assert!(manager.unregister(id).await);
        assert!(manager.list().await.is_empty());
    }

    #[tokio::test]
    async fn unregister_unknown_returns_false() {
        let manager = BridgeManager::new();
        assert!(!manager.unregister(Uuid::new_v4()).await);
    }

    #[tokio::test]
    async fn send_to_external_no_matching_bridge() {
        let manager = BridgeManager::new();
        let result = manager
            .send_to_external(BridgeSource::Slack, "general", "test message")
            .await;
        assert!(!result);
    }

    #[tokio::test]
    async fn send_to_external_channel_not_mapped() {
        let manager = BridgeManager::new();
        let channels = HashMap::new();

        let config = BridgeConfig::new(
            BridgeSource::Slack,
            "https://hooks.slack.com/services/T00000/B00000/XXXX".to_string(),
            channels,
        );
        manager.register(config).await;

        let result = manager
            .send_to_external(BridgeSource::Slack, "general", "test message")
            .await;
        assert!(!result);
    }
}
