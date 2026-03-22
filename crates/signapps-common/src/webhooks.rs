//! # Outbound Webhooks System
//!
//! Manages webhook registrations and delivers signed HTTP POST notifications
//! to external endpoints when domain events occur.
//!
//! ## Signature
//!
//! Each delivery includes an `X-Signature-256` header containing the
//! HMAC-SHA256 of the request body, hex-encoded, using the webhook secret.
//!
//! ## Usage
//!
//! ```rust,ignore
//! use signapps_common::webhooks::{WebhookConfig, WebhookManager};
//! use uuid::Uuid;
//!
//! let manager = WebhookManager::new();
//!
//! let config = WebhookConfig::new(
//!     "https://example.com/hooks".to_string(),
//!     "my-secret".to_string(),
//!     vec!["user.created".to_string()],
//! );
//!
//! manager.register(config).await;
//! manager.deliver("user.created", &payload_bytes).await;
//! ```

use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

/// Status of a webhook delivery attempt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DeliveryStatus {
    /// Delivery succeeded (2xx response).
    Success,
    /// Delivery failed (non-2xx or network error).
    Failed,
    /// Delivery is pending (not yet attempted).
    Pending,
}

/// Configuration for a registered webhook endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookConfig {
    /// Unique identifier for this webhook.
    pub id: Uuid,
    /// Target URL to POST events to.
    pub url: String,
    /// HMAC-SHA256 secret for payload signing.
    pub secret: String,
    /// List of event types this webhook subscribes to (e.g. `"user.created"`).
    /// An empty list means the webhook receives all events.
    pub events: Vec<String>,
    /// Whether this webhook is active.
    pub enabled: bool,
    /// Timestamp when this webhook was registered.
    pub created_at: DateTime<Utc>,
}

impl WebhookConfig {
    /// Create a new enabled webhook configuration.
    pub fn new(url: String, secret: String, events: Vec<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            url,
            secret,
            events,
            enabled: true,
            created_at: Utc::now(),
        }
    }
}

/// Record of a single webhook delivery attempt.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookDelivery {
    /// Unique identifier for this delivery record.
    pub id: Uuid,
    /// The webhook that was invoked.
    pub webhook_id: Uuid,
    /// Event type that triggered this delivery.
    pub event: String,
    /// Outcome of the delivery attempt.
    pub status: DeliveryStatus,
    /// HTTP response status code, if a response was received.
    pub response_code: Option<u16>,
    /// Timestamp when the delivery was attempted.
    pub attempted_at: DateTime<Utc>,
}

/// In-memory webhook manager.
///
/// Thread-safe via `Arc<RwLock<_>>` internals; cheap to clone.
#[derive(Debug, Clone, Default)]
pub struct WebhookManager {
    configs: Arc<RwLock<Vec<WebhookConfig>>>,
    client: Arc<reqwest::Client>,
}

impl WebhookManager {
    /// Create a new `WebhookManager` with a shared HTTP client.
    pub fn new() -> Self {
        Self {
            configs: Arc::new(RwLock::new(Vec::new())),
            client: Arc::new(reqwest::Client::new()),
        }
    }

    /// Register a new webhook. Returns the assigned [`Uuid`].
    pub async fn register(&self, config: WebhookConfig) -> Uuid {
        let id = config.id;
        info!(webhook_id = %id, url = %config.url, "Registering webhook");
        self.configs.write().await.push(config);
        id
    }

    /// Unregister a webhook by its ID. Returns `true` if it was found and removed.
    pub async fn unregister(&self, id: Uuid) -> bool {
        let mut configs = self.configs.write().await;
        let before = configs.len();
        configs.retain(|c| c.id != id);
        let removed = configs.len() < before;
        if removed {
            info!(webhook_id = %id, "Webhook unregistered");
        } else {
            warn!(webhook_id = %id, "Webhook not found for unregister");
        }
        removed
    }

    /// List all registered webhooks (cloned snapshot).
    pub async fn list(&self) -> Vec<WebhookConfig> {
        self.configs.read().await.clone()
    }

    /// Deliver an event to all matching, enabled webhooks.
    ///
    /// Sends an HTTP POST with the JSON payload and an HMAC-SHA256 signature
    /// in the `X-Signature-256` header. Returns one [`WebhookDelivery`] per
    /// webhook that matched the event.
    pub async fn deliver(
        &self,
        event: &str,
        payload: &[u8],
    ) -> Vec<WebhookDelivery> {
        let configs = self.configs.read().await.clone();
        let matching: Vec<_> = configs
            .into_iter()
            .filter(|c| c.enabled && (c.events.is_empty() || c.events.iter().any(|e| e == event)))
            .collect();

        let mut deliveries = Vec::with_capacity(matching.len());

        for config in matching {
            let delivery = self.send_one(&config, event, payload).await;
            deliveries.push(delivery);
        }

        deliveries
    }

    // ── Private ──────────────────────────────────────────────────────────────

    async fn send_one(
        &self,
        config: &WebhookConfig,
        event: &str,
        payload: &[u8],
    ) -> WebhookDelivery {
        let signature = compute_signature(&config.secret, payload);

        let result = self
            .client
            .post(&config.url)
            .header("Content-Type", "application/json")
            .header("X-Signature-256", &signature)
            .header("X-Event-Type", event)
            .body(payload.to_vec())
            .send()
            .await;

        let (status, response_code) = match result {
            Ok(resp) => {
                let code = resp.status().as_u16();
                if resp.status().is_success() {
                    info!(
                        webhook_id = %config.id,
                        event,
                        status_code = code,
                        "Webhook delivery succeeded"
                    );
                    (DeliveryStatus::Success, Some(code))
                } else {
                    warn!(
                        webhook_id = %config.id,
                        event,
                        status_code = code,
                        "Webhook delivery returned non-2xx"
                    );
                    (DeliveryStatus::Failed, Some(code))
                }
            }
            Err(err) => {
                error!(
                    webhook_id = %config.id,
                    event,
                    error = %err,
                    "Webhook delivery network error"
                );
                (DeliveryStatus::Failed, None)
            }
        };

        WebhookDelivery {
            id: Uuid::new_v4(),
            webhook_id: config.id,
            event: event.to_string(),
            status,
            response_code,
            attempted_at: Utc::now(),
        }
    }
}

/// Compute `hmac-sha256(secret, payload)` and return it as a lowercase hex string.
fn compute_signature(secret: &str, payload: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .expect("HMAC accepts keys of any length");
    mac.update(payload);
    hex::encode(mac.finalize().into_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signature_is_deterministic() {
        let sig1 = compute_signature("secret", b"hello");
        let sig2 = compute_signature("secret", b"hello");
        assert_eq!(sig1, sig2);
    }

    #[test]
    fn signature_differs_with_different_secret() {
        let sig1 = compute_signature("secret1", b"hello");
        let sig2 = compute_signature("secret2", b"hello");
        assert_ne!(sig1, sig2);
    }

    #[test]
    fn signature_differs_with_different_payload() {
        let sig1 = compute_signature("secret", b"hello");
        let sig2 = compute_signature("secret", b"world");
        assert_ne!(sig1, sig2);
    }

    #[tokio::test]
    async fn register_and_list() {
        let manager = WebhookManager::new();
        let cfg = WebhookConfig::new(
            "https://example.com/hook".to_string(),
            "s3cr3t".to_string(),
            vec!["user.created".to_string()],
        );
        let id = manager.register(cfg).await;
        let list = manager.list().await;
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, id);
    }

    #[tokio::test]
    async fn unregister_removes_webhook() {
        let manager = WebhookManager::new();
        let cfg = WebhookConfig::new(
            "https://example.com/hook".to_string(),
            "s3cr3t".to_string(),
            vec![],
        );
        let id = manager.register(cfg).await;
        assert!(manager.unregister(id).await);
        assert!(manager.list().await.is_empty());
    }

    #[tokio::test]
    async fn unregister_unknown_returns_false() {
        let manager = WebhookManager::new();
        assert!(!manager.unregister(Uuid::new_v4()).await);
    }
}
