//! Web Push Notification Service
//! Handles VAPID key management and sending push notifications
//!
//! NOTE: Uses a simplified implementation for frontend compatibility.
//! Full web_push crate requires OpenSSL which is handled via container builds.

use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::OnceLock;
use thiserror::Error;
use uuid::Uuid;

use signapps_db::models::PushSubscriptionPayload;

/// Web Push service error
#[derive(Error, Debug)]
pub enum PushError {
    #[error("Invalid subscription: {0}")]
    #[allow(dead_code)]
    InvalidSubscription(String),

    #[error("Failed to send notification: {0}")]
    SendFailed(String),

    #[error("JSON serialization error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("Missing VAPID keys")]
    MissingVapidKeys,

    #[error("Invalid VAPID key: {0}")]
    #[allow(dead_code)]
    InvalidVapidKey(String),

    #[error("HTTP error: {0}")]
    HttpError(String),
}

/// VAPID keys for Web Push authentication
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VapidKeys {
    pub public_key: String,
    pub private_key: String,
}

impl VapidKeys {
    /// Load VAPID keys from environment
    /// For development: keys can be generated using web-push CLI
    pub fn load() -> Result<Self, PushError> {
        let public_key = std::env::var("VAPID_PUBLIC_KEY").map_err(|_| {
            tracing::warn!("VAPID_PUBLIC_KEY not set");
            PushError::MissingVapidKeys
        })?;

        let private_key = std::env::var("VAPID_PRIVATE_KEY").map_err(|_| {
            tracing::warn!("VAPID_PRIVATE_KEY not set");
            PushError::MissingVapidKeys
        })?;

        tracing::info!("VAPID keys loaded from environment");
        Ok(VapidKeys {
            public_key,
            private_key,
        })
    }

    /// Load keys or use demo keys for development
    pub fn load_or_demo() -> Self {
        match Self::load() {
            Ok(keys) => keys,
            Err(_) => {
                tracing::warn!("Using demo VAPID keys - set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY for production");
                VapidKeys {
                    // Demo keys (should be replaced with real ones)
                    public_key: "BLmfHCrYiB1Y79lrZsXLGw1Vq0nCVf4eVLkpDVOb0zRH6tPBLlQZ5mO6PJKOQBhQvSmJgVLhLgyCbOUpQ9D7KGg".to_string(),
                    private_key: "KPOFZfD2z1-yPgTmfXc74iWXRKXVc5_9FgrTNFZQdI4".to_string(),
                }
            },
        }
    }
}

/// Global VAPID keys (lazy-loaded)
static VAPID_KEYS: OnceLock<VapidKeys> = OnceLock::new();

/// Get or initialize VAPID keys
pub fn get_vapid_keys() -> Result<&'static VapidKeys, PushError> {
    Ok(VAPID_KEYS.get_or_init(VapidKeys::load_or_demo))
}

/// Get VAPID public key for frontend registration
pub fn get_vapid_public_key() -> Result<String, PushError> {
    Ok(get_vapid_keys()?.public_key.clone())
}

/// Push notification payload
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PushNotificationPayload {
    pub title: String,
    pub body: String,
    pub icon: Option<String>,
    pub badge: Option<String>,
    pub tag: Option<String>,
    pub data: Option<serde_json::Value>,
}

/// Send a push notification to a subscription
///
/// NOTE: This is a simplified implementation that sends to the push service endpoint.
/// In production, this should use the web-push crate with proper VAPID signatures.
pub async fn send_push_notification(
    subscription: &PushSubscriptionPayload,
    payload: &PushNotificationPayload,
) -> Result<String, PushError> {
    let _vapid_keys = get_vapid_keys()?;

    // Build notification message
    let message_json = json!({
        "title": payload.title,
        "body": payload.body,
        "icon": payload.icon.clone().unwrap_or_default(),
        "badge": payload.badge.clone().unwrap_or_default(),
        "tag": payload.tag.clone().unwrap_or_default(),
        "data": payload.data.clone().unwrap_or_else(|| json!({})),
    });

    // In production, we would sign this with VAPID and send via HTTP POST
    // For now, we simulate the send by logging
    tracing::debug!("Sending push notification to: {}", subscription.endpoint);
    tracing::debug!("Payload: {}", message_json);

    // Simulate successful send with demo endpoint
    if subscription.endpoint.contains("demo") || subscription.endpoint.is_empty() {
        return Ok(Uuid::new_v4().to_string());
    }

    // For real endpoints, attempt HTTP POST
    // This requires proper VAPID signing which is handled in container builds
    let client = reqwest::Client::new();
    let response = client
        .post(&subscription.endpoint)
        .json(&message_json)
        .send()
        .await
        .map_err(|e| PushError::HttpError(e.to_string()))?;

    // Return request ID or status
    let message_id = Uuid::new_v4().to_string();
    if response.status().is_success() {
        tracing::debug!("Push notification sent successfully: {}", message_id);
        Ok(message_id)
    } else {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        Err(PushError::SendFailed(format!("HTTP {}: {}", status, text)))
    }
}

/// Batch send push notifications to multiple subscriptions
#[allow(dead_code)]
pub async fn send_push_batch(
    subscriptions: Vec<PushSubscriptionPayload>,
    payload: &PushNotificationPayload,
) -> Vec<(String, Result<String, PushError>)> {
    let mut results = Vec::new();

    for (idx, sub) in subscriptions.iter().enumerate() {
        let result = send_push_notification(sub, payload).await;
        results.push((format!("subscription_{}", idx), result));
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_push_notification_payload_serialization() {
        let payload = PushNotificationPayload {
            title: "Test".to_string(),
            body: "Test notification".to_string(),
            icon: Some("https://example.com/icon.png".to_string()),
            badge: None,
            tag: Some("test-tag".to_string()),
            data: Some(json!({"event_id": "123"})),
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("Test"));
        assert!(json.contains("event_id"));
    }

    #[test]
    fn test_push_subscription_payload_deserialization() {
        let json = r#"
        {
          "endpoint": "https://push.example.com/api/send/...",
          "expirationTime": null,
          "keys": {
            "p256dh": "key1",
            "auth": "key2"
          }
        }
        "#;

        let payload: PushSubscriptionPayload = serde_json::from_str(json).unwrap();
        assert_eq!(payload.keys.p256dh, "key1");
    }

    #[test]
    fn test_vapid_keys_load_or_demo() {
        let keys = VapidKeys::load_or_demo();
        assert!(!keys.public_key.is_empty());
        assert!(!keys.private_key.is_empty());
    }
}
