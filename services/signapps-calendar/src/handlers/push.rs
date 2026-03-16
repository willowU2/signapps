//! Push notification handlers
//! Manages Web Push API notifications and VAPID key distribution

use axum::{extract::State, response::Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use signapps_common::Claims;
use signapps_db::repositories::PushSubscriptionRepository;

use crate::{
    services::{get_vapid_public_key, send_push_notification, PushNotificationPayload},
    AppState, CalendarError,
};

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/// Request to send a push notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendPushRequest {
    /// Notification title
    pub title: String,
    /// Notification body/message (accepts both "body" and "message" from frontend)
    #[serde(alias = "message")]
    pub body: String,
    /// Notification type (event_reminder, task_due, etc.)
    #[serde(alias = "type", default)]
    pub notification_type: Option<String>,
    /// Channel (push, email, sms) - for frontend compatibility
    #[serde(default)]
    pub channel: Option<String>,
    /// Recipient (self, user_id) - for frontend compatibility
    #[serde(default)]
    pub recipient: Option<String>,
    /// Optional icon URL
    pub icon: Option<String>,
    /// Optional badge URL
    pub badge: Option<String>,
    /// Optional tag for grouping
    pub tag: Option<String>,
    /// Additional data for the notification
    pub data: Option<serde_json::Value>,
    /// If true, send to all user's subscriptions; otherwise send to specific subscription
    pub send_to_all: Option<bool>,
    /// Specific subscription ID to send to (if send_to_all is false)
    pub subscription_id: Option<Uuid>,
}

/// Response with VAPID public key
#[derive(Debug, Clone, Serialize)]
pub struct VapidKeyResponse {
    pub public_key: String,
}

/// Batch push send result
#[derive(Debug, Clone, Serialize)]
pub struct BatchPushSendResult {
    pub total: usize,
    pub successful: usize,
    pub failed: usize,
    pub results: Vec<PushSendResultItem>,
}

/// Individual push send result item
#[derive(Debug, Clone, Serialize)]
pub struct PushSendResultItem {
    pub subscription_id: String,
    pub success: bool,
    pub message_id: Option<String>,
    pub error: Option<String>,
}

// ============================================================================
// HANDLERS
// ============================================================================

/// GET /api/v1/notifications/push/vapid-key
/// Get VAPID public key for frontend registration
pub async fn get_vapid_key() -> Result<Json<VapidKeyResponse>, CalendarError> {
    let public_key = get_vapid_public_key()
        .map_err(|_| CalendarError::internal("Failed to retrieve VAPID key"))?;

    Ok(Json(VapidKeyResponse { public_key }))
}

/// POST /api/v1/notifications/push/send
/// Send a push notification to user's subscriptions
pub async fn send_push(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<SendPushRequest>,
) -> Result<Json<BatchPushSendResult>, CalendarError> {
    // Validate request
    if req.title.is_empty() || req.body.is_empty() {
        return Err(CalendarError::bad_request("title and body are required"));
    }

    // Get user's push subscriptions
    let subscriptions = PushSubscriptionRepository::get_by_user(&state.pool, claims.sub)
        .await
        .map_err(|_| CalendarError::internal("Failed to fetch push subscriptions"))?;

    if subscriptions.is_empty() {
        return Err(CalendarError::bad_request(
            "No push subscriptions found for user",
        ));
    }

    // Filter subscriptions if specific one is requested
    let subscriptions_to_send: Vec<_> = if !req.send_to_all.unwrap_or(true) {
        if let Some(sub_id) = req.subscription_id {
            subscriptions
                .into_iter()
                .filter(|s| s.id == sub_id)
                .collect()
        } else {
            return Err(CalendarError::bad_request(
                "subscription_id required when send_to_all is false",
            ));
        }
    } else {
        subscriptions
    };

    if subscriptions_to_send.is_empty() {
        return Err(CalendarError::not_found("No matching subscriptions found"));
    }

    // Build notification payload
    let payload = PushNotificationPayload {
        title: req.title.clone(),
        body: req.body.clone(),
        icon: req.icon.clone(),
        badge: req.badge.clone(),
        tag: req.tag.clone(),
        data: req.data.clone(),
    };

    // Send to each subscription
    let mut results = Vec::new();
    let mut successful = 0;
    let mut failed = 0;

    for sub in subscriptions_to_send {
        match sub.subscription() {
            Ok(sub_payload) => {
                match send_push_notification(&sub_payload, &payload).await {
                    Ok(message_id) => {
                        successful += 1;
                        results.push(PushSendResultItem {
                            subscription_id: sub.id.to_string(),
                            success: true,
                            message_id: Some(message_id.clone()),
                            error: None,
                        });

                        // Log to database
                        let _ = log_push_sent(&state, claims.sub, &message_id).await;
                    },
                    Err(e) => {
                        failed += 1;
                        let error_msg = e.to_string();
                        results.push(PushSendResultItem {
                            subscription_id: sub.id.to_string(),
                            success: false,
                            message_id: None,
                            error: Some(error_msg),
                        });
                    },
                }
            },
            Err(e) => {
                failed += 1;
                results.push(PushSendResultItem {
                    subscription_id: sub.id.to_string(),
                    success: false,
                    message_id: None,
                    error: Some(format!("Invalid subscription JSON: {}", e)),
                });
            },
        }
    }

    Ok(Json(BatchPushSendResult {
        total: results.len(),
        successful,
        failed,
        results,
    }))
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Log a sent push notification to the database
async fn log_push_sent(
    state: &AppState,
    user_id: Uuid,
    _message_id: &str,
) -> Result<(), CalendarError> {
    use signapps_db::repositories::NotificationSentRepository;

    let _ = NotificationSentRepository::create(
        &state.pool,
        user_id,
        None, // No specific event
        None, // No specific task
        "push_notification",
        "push",
        None,
    )
    .await;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_send_push_request_serialization() {
        let req = SendPushRequest {
            title: "Test".to_string(),
            body: "Test notification".to_string(),
            notification_type: Some("event_reminder".to_string()),
            channel: Some("push".to_string()),
            recipient: Some("self".to_string()),
            icon: Some("https://example.com/icon.png".to_string()),
            badge: None,
            tag: Some("test-tag".to_string()),
            data: Some(serde_json::json!({"event_id": "123"})),
            send_to_all: Some(true),
            subscription_id: None,
        };

        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("Test"));
        assert!(json.contains("event_reminder"));
    }

    #[test]
    fn test_send_push_request_deserialization_with_aliases() {
        // Test that frontend format with "message" and "type" works
        let frontend_json = r#"{
            "title": "Test Title",
            "message": "Test message body",
            "type": "event_reminder",
            "channel": "push",
            "recipient": "self"
        }"#;

        let req: SendPushRequest = serde_json::from_str(frontend_json).unwrap();
        assert_eq!(req.title, "Test Title");
        assert_eq!(req.body, "Test message body"); // "message" mapped to "body"
        assert_eq!(req.notification_type, Some("event_reminder".to_string())); // "type" mapped
        assert_eq!(req.channel, Some("push".to_string()));
    }

    #[test]
    fn test_vapid_key_response_serialization() {
        let resp = VapidKeyResponse {
            public_key: "test_public_key".to_string(),
        };

        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("test_public_key"));
    }

    #[test]
    fn test_batch_push_send_result_serialization() {
        let result = BatchPushSendResult {
            total: 2,
            successful: 1,
            failed: 1,
            results: vec![
                PushSendResultItem {
                    subscription_id: "sub1".to_string(),
                    success: true,
                    message_id: Some("msg1".to_string()),
                    error: None,
                },
                PushSendResultItem {
                    subscription_id: "sub2".to_string(),
                    success: false,
                    message_id: None,
                    error: Some("Send failed".to_string()),
                },
            ],
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("successful"));
        assert!(json.contains("failed"));
    }
}
