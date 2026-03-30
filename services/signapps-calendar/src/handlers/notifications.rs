/// Notification handlers
/// Manages user notification preferences, history, and settings
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use signapps_common::Claims;
use signapps_db::{
    models::UpdateNotificationPreferencesRequest,
    repositories::{
        NotificationPreferencesRepository, NotificationSentRepository, PushSubscriptionRepository,
    },
};

use crate::{AppState, CalendarError};

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/// Update notification preferences request
#[derive(Debug, Clone, Serialize, Deserialize)]
/// Request body for UpdatePreferences.
pub struct UpdatePreferencesRequest {
    pub email_enabled: Option<bool>,
    pub email_frequency: Option<String>,
    pub sms_enabled: Option<bool>,
    pub phone_number: Option<String>,
    pub push_enabled: Option<bool>,
    pub quiet_hours_enabled: Option<bool>,
    pub quiet_start: Option<String>, // HH:MM format
    pub quiet_end: Option<String>,   // HH:MM format
    pub reminder_times: Option<Vec<i32>>,
}

/// Paginated notification history response
#[derive(Debug, Clone, Serialize)]
/// Response for NotificationHistory.
pub struct NotificationHistoryResponse {
    pub notifications: Vec<NotificationRecord>,
    pub total: i64,
    pub page: i32,
    pub limit: i32,
}

/// Single notification record for history
#[derive(Debug, Clone, Serialize)]
/// NotificationRecord data transfer object.
pub struct NotificationRecord {
    pub id: String,
    pub notification_type: String,
    pub channel: String,
    pub status: String,
    pub recipient_address: Option<String>,
    pub created_at: String,
    pub sent_at: Option<String>,
}

// ============================================================================
// HANDLERS
// ============================================================================

/// GET /api/v1/notifications/preferences
/// Get user's notification preferences
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_preferences(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<serde_json::Value>, CalendarError> {
    let prefs = NotificationPreferencesRepository::get_or_create(&state.pool, claims.sub)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get/create notification preferences: {}", e);
            CalendarError::internal(&format!("Notification preferences error: {}", e))
        })?;

    Ok(Json(serde_json::json!({
        "id": prefs.id.to_string(),
        "email_enabled": prefs.email_enabled,
        "email_frequency": prefs.email_frequency,
        "sms_enabled": prefs.sms_enabled,
        "phone_number": prefs.phone_number,
        "push_enabled": prefs.push_enabled,
        "quiet_hours_enabled": prefs.quiet_hours_enabled,
        "quiet_start": prefs.quiet_start.map(|t| t.to_string()),
        "quiet_end": prefs.quiet_end.map(|t| t.to_string()),
        "reminder_times": prefs.reminder_times,
    })))
}

/// PUT /api/v1/notifications/preferences
/// Update user's notification preferences
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn update_preferences(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<UpdatePreferencesRequest>,
) -> Result<Json<serde_json::Value>, CalendarError> {
    // Convert quiet hours to NaiveTime
    let quiet_start = req
        .quiet_start
        .and_then(|s| chrono::NaiveTime::parse_from_str(&s, "%H:%M").ok());

    let quiet_end = req
        .quiet_end
        .and_then(|s| chrono::NaiveTime::parse_from_str(&s, "%H:%M").ok());

    let update = UpdateNotificationPreferencesRequest {
        email_enabled: req.email_enabled,
        email_frequency: req.email_frequency,
        sms_enabled: req.sms_enabled,
        phone_number: req.phone_number,
        push_enabled: req.push_enabled,
        quiet_hours_enabled: req.quiet_hours_enabled,
        quiet_start,
        quiet_end,
        reminder_times: req.reminder_times,
    };

    let prefs = NotificationPreferencesRepository::update(&state.pool, claims.sub, update)
        .await
        .map_err(|_| CalendarError::internal("Failed to update preferences"))?;

    Ok(Json(serde_json::json!({
        "id": prefs.id.to_string(),
        "email_enabled": prefs.email_enabled,
        "email_frequency": prefs.email_frequency,
        "push_enabled": prefs.push_enabled,
        "updated_at": prefs.updated_at.to_rfc3339(),
    })))
}

/// POST /api/v1/notifications/subscriptions/push
/// Register a Web Push API subscription
#[derive(Debug, Clone, Deserialize)]
/// Request body for PushSubscription.
pub struct PushSubscriptionRequest {
    pub subscription: serde_json::Value, // Web Push API subscription object
    pub browser_name: Option<String>,
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn subscribe_push(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<PushSubscriptionRequest>,
) -> Result<StatusCode, CalendarError> {
    PushSubscriptionRepository::create(&state.pool, claims.sub, req.subscription, req.browser_name)
        .await
        .map_err(|_| CalendarError::internal("Failed to register push subscription"))?;

    Ok(StatusCode::CREATED)
}

/// GET /api/v1/notifications/subscriptions/push
/// Get all push subscriptions for user
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_push_subscriptions(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<serde_json::Value>>, CalendarError> {
    let subscriptions = PushSubscriptionRepository::get_by_user(&state.pool, claims.sub)
        .await
        .map_err(|_| CalendarError::internal("Failed to fetch push subscriptions"))?;

    let response: Vec<serde_json::Value> = subscriptions
        .iter()
        .map(|s| {
            serde_json::json!({
                "id": s.id.to_string(),
                "browser_name": s.browser_name,
                "created_at": s.created_at.to_rfc3339(),
            })
        })
        .collect();

    Ok(Json(response))
}

/// DELETE /api/v1/notifications/subscriptions/push/:id
/// Unregister a push subscription
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn unsubscribe_push(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Path(subscription_id): Path<Uuid>,
) -> Result<StatusCode, CalendarError> {
    // Verify subscription belongs to user (simple check)
    let subs = PushSubscriptionRepository::get_by_user(&state.pool, claims.sub)
        .await
        .map_err(|_| CalendarError::internal("Failed to fetch subscriptions"))?;

    if !subs.iter().any(|s| s.id == subscription_id) {
        return Err(CalendarError::forbidden("Subscription not owned by user"));
    }

    PushSubscriptionRepository::delete(&state.pool, subscription_id)
        .await
        .map_err(|_| CalendarError::internal("Failed to delete subscription"))?;

    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/v1/notifications/history
/// Get notification history with filtering and pagination
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
/// Query parameters for filtering results.
pub struct NotificationHistoryQuery {
    pub notification_type: Option<String>,
    pub channel: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_notification_history(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Query(query): Query<NotificationHistoryQuery>,
) -> Result<Json<NotificationHistoryResponse>, CalendarError> {
    let limit = query.limit.unwrap_or(20).min(100);
    let offset = query.offset.unwrap_or(0);

    let notifications =
        NotificationSentRepository::get_history(&state.pool, claims.sub, limit, offset)
            .await
            .map_err(|_| CalendarError::internal("Failed to fetch notification history"))?;

    let response: Vec<NotificationRecord> = notifications
        .iter()
        .map(|n| NotificationRecord {
            id: n.id.to_string(),
            notification_type: n.notification_type.clone(),
            channel: n.channel.clone(),
            status: n.status.clone(),
            recipient_address: n.recipient_address.clone(),
            created_at: n.created_at.to_rfc3339(),
            sent_at: n.sent_at.map(|d| d.to_rfc3339()),
        })
        .collect();

    Ok(Json(NotificationHistoryResponse {
        total: response.len() as i64,
        notifications: response,
        page: offset / limit,
        limit,
    }))
}

/// POST /api/v1/notifications/:id/resend
/// Resend a failed notification
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn resend_notification(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Path(notification_id): Path<Uuid>,
) -> Result<StatusCode, CalendarError> {
    let notification = NotificationSentRepository::get_by_id(&state.pool, notification_id)
        .await
        .map_err(|_| CalendarError::not_found("Notification not found"))?;

    // Verify user owns this notification
    if notification.user_id != claims.sub {
        return Err(CalendarError::forbidden("Notification not owned by user"));
    }

    // Only allow resending failed notifications
    if notification.status != "failed" {
        return Err(CalendarError::bad_request(
            "Can only resend failed notifications",
        ));
    }

    // In real implementation, would re-queue for sending
    // For now, just mark as pending again
    NotificationSentRepository::update_status(&state.pool, notification_id, "pending", None)
        .await
        .map_err(|_| CalendarError::internal("Failed to resend notification"))?;

    Ok(StatusCode::OK)
}

/// GET /api/v1/notifications/unread-count
/// Get count of unread notifications
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_unread_count(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<serde_json::Value>, CalendarError> {
    let pending = NotificationSentRepository::count_by_status(&state.pool, claims.sub, "pending")
        .await
        .unwrap_or(0);

    let failed = NotificationSentRepository::count_by_status(&state.pool, claims.sub, "failed")
        .await
        .unwrap_or(0);

    Ok(Json(serde_json::json!({
        "pending": pending,
        "failed": failed,
        "total": pending + failed,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preference_update_request_serialization() {
        let req = UpdatePreferencesRequest {
            email_enabled: Some(true),
            email_frequency: Some("instant".to_string()),
            sms_enabled: Some(false),
            phone_number: None,
            push_enabled: Some(true),
            quiet_hours_enabled: Some(false),
            quiet_start: None,
            quiet_end: None,
            reminder_times: Some(vec![15, 60, 1440]),
        };

        let json = serde_json::to_string(&req).expect("serialization should succeed");
        assert!(json.contains("email_enabled"));
        assert!(json.contains("instant"));
    }

    #[test]
    fn test_quiet_time_parsing() {
        let time_str = "22:30";
        let parsed = chrono::NaiveTime::parse_from_str(time_str, "%H:%M");
        assert!(parsed.is_ok());
    }

    #[test]
    fn test_notification_history_response() {
        let response = NotificationHistoryResponse {
            notifications: vec![],
            total: 0,
            page: 0,
            limit: 20,
        };

        let json = serde_json::to_string(&response).expect("serialization should succeed");
        assert!(json.contains("notifications"));
        assert!(json.contains("total"));
    }
}
