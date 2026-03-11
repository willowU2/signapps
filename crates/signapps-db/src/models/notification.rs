/// Notification system models
/// Handles email, SMS, and push notification preferences and history
use chrono::{DateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

/// User notification preferences (system-wide or per-calendar)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NotificationPreferences {
    pub id: Uuid,
    pub user_id: Uuid,
    pub calendar_id: Option<Uuid>,

    // Email settings
    pub email_enabled: bool,
    pub email_frequency: String, // instant, digest, disabled
    pub sms_enabled: bool,
    pub phone_number: Option<String>,
    pub push_enabled: bool,

    // Quiet hours
    pub quiet_hours_enabled: bool,
    pub quiet_start: Option<NaiveTime>,
    pub quiet_end: Option<NaiveTime>,

    // Reminders (in minutes)
    pub reminder_times: Vec<i32>,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create or update notification preferences
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateNotificationPreferencesRequest {
    pub email_enabled: Option<bool>,
    pub email_frequency: Option<String>,
    pub sms_enabled: Option<bool>,
    pub phone_number: Option<String>,
    pub push_enabled: Option<bool>,
    pub quiet_hours_enabled: Option<bool>,
    pub quiet_start: Option<NaiveTime>,
    pub quiet_end: Option<NaiveTime>,
    pub reminder_times: Option<Vec<i32>>,
}

// ============================================================================
// PUSH SUBSCRIPTIONS
// ============================================================================

/// Web Push API subscription
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushSubscriptionPayload {
    pub endpoint: String,
    #[serde(rename = "expirationTime")]
    pub expiration_time: Option<i64>,
    pub keys: PushSubscriptionKeys,
}

/// Push subscription encryption keys
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushSubscriptionKeys {
    pub p256dh: String,
    pub auth: String,
}

/// Stored push subscription record
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PushSubscription {
    pub id: Uuid,
    pub user_id: Uuid,
    pub subscription_json: serde_json::Value, // JSONB
    pub user_agent: Option<String>,
    pub browser_name: Option<String>,
    pub browser_version: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl PushSubscription {
    /// Deserialize subscription JSON
    pub fn subscription(&self) -> Result<PushSubscriptionPayload, serde_json::Error> {
        serde_json::from_value(self.subscription_json.clone())
    }
}

// ============================================================================
// NOTIFICATIONS SENT (Audit Log)
// ============================================================================

/// Notification type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NotificationType {
    #[serde(rename = "event_reminder")]
    EventReminder,
    #[serde(rename = "event_invitation")]
    EventInvitation,
    #[serde(rename = "attendee_rsvp")]
    AttendeeRsvp,
    #[serde(rename = "task_assigned")]
    TaskAssigned,
    #[serde(rename = "task_completed")]
    TaskCompleted,
    #[serde(rename = "daily_digest")]
    DailyDigest,
    #[serde(rename = "weekly_digest")]
    WeeklyDigest,
}

impl NotificationType {
    pub fn as_str(&self) -> &str {
        match self {
            NotificationType::EventReminder => "event_reminder",
            NotificationType::EventInvitation => "event_invitation",
            NotificationType::AttendeeRsvp => "attendee_rsvp",
            NotificationType::TaskAssigned => "task_assigned",
            NotificationType::TaskCompleted => "task_completed",
            NotificationType::DailyDigest => "daily_digest",
            NotificationType::WeeklyDigest => "weekly_digest",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "event_reminder" => Some(NotificationType::EventReminder),
            "event_invitation" => Some(NotificationType::EventInvitation),
            "attendee_rsvp" => Some(NotificationType::AttendeeRsvp),
            "task_assigned" => Some(NotificationType::TaskAssigned),
            "task_completed" => Some(NotificationType::TaskCompleted),
            "daily_digest" => Some(NotificationType::DailyDigest),
            "weekly_digest" => Some(NotificationType::WeeklyDigest),
            _ => None,
        }
    }
}

/// Notification delivery channel
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NotificationChannel {
    #[serde(rename = "email")]
    Email,
    #[serde(rename = "sms")]
    Sms,
    #[serde(rename = "push")]
    Push,
}

impl NotificationChannel {
    pub fn as_str(&self) -> &str {
        match self {
            NotificationChannel::Email => "email",
            NotificationChannel::Sms => "sms",
            NotificationChannel::Push => "push",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "email" => Some(NotificationChannel::Email),
            "sms" => Some(NotificationChannel::Sms),
            "push" => Some(NotificationChannel::Push),
            _ => None,
        }
    }
}

/// Notification delivery status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NotificationStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "sent")]
    Sent,
    #[serde(rename = "delivered")]
    Delivered,
    #[serde(rename = "read")]
    Read,
    #[serde(rename = "failed")]
    Failed,
    #[serde(rename = "bounced")]
    Bounced,
    #[serde(rename = "unsubscribed")]
    Unsubscribed,
}

impl NotificationStatus {
    pub fn as_str(&self) -> &str {
        match self {
            NotificationStatus::Pending => "pending",
            NotificationStatus::Sent => "sent",
            NotificationStatus::Delivered => "delivered",
            NotificationStatus::Read => "read",
            NotificationStatus::Failed => "failed",
            NotificationStatus::Bounced => "bounced",
            NotificationStatus::Unsubscribed => "unsubscribed",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pending" => Some(NotificationStatus::Pending),
            "sent" => Some(NotificationStatus::Sent),
            "delivered" => Some(NotificationStatus::Delivered),
            "read" => Some(NotificationStatus::Read),
            "failed" => Some(NotificationStatus::Failed),
            "bounced" => Some(NotificationStatus::Bounced),
            "unsubscribed" => Some(NotificationStatus::Unsubscribed),
            _ => None,
        }
    }
}

/// Sent notification record (audit log)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NotificationSent {
    pub id: Uuid,
    pub user_id: Uuid,
    pub event_id: Option<Uuid>,
    pub task_id: Option<Uuid>,

    pub notification_type: String,
    pub channel: String,
    pub recipient_address: Option<String>,

    pub status: String,
    pub error_message: Option<String>,

    pub created_at: DateTime<Utc>,
    pub sent_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub read_at: Option<DateTime<Utc>>,
    pub failed_at: Option<DateTime<Utc>>,

    pub external_id: Option<String>,
    pub retry_count: i32,

    pub metadata: Option<serde_json::Value>,
}

impl NotificationSent {
    pub fn notification_type(&self) -> Option<NotificationType> {
        NotificationType::from_str(&self.notification_type)
    }

    pub fn channel(&self) -> Option<NotificationChannel> {
        NotificationChannel::from_str(&self.channel)
    }

    pub fn status(&self) -> Option<NotificationStatus> {
        NotificationStatus::from_str(&self.status)
    }
}

/// Request to create a notification
#[derive(Debug, Clone, Deserialize)]
pub struct CreateNotificationRequest {
    pub user_id: Uuid,
    pub event_id: Option<Uuid>,
    pub task_id: Option<Uuid>,
    pub notification_type: String,
    pub channel: String,
    pub recipient_address: Option<String>,
}

/// Filter for querying notifications
#[derive(Debug, Clone, Deserialize)]
pub struct NotificationFilter {
    pub notification_type: Option<String>,
    pub channel: Option<String>,
    pub status: Option<String>,
    pub from_date: Option<DateTime<Utc>>,
    pub to_date: Option<DateTime<Utc>>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

// ============================================================================
// NOTIFICATION TEMPLATES
// ============================================================================

/// Email/SMS/Push template
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NotificationTemplate {
    pub id: Uuid,
    pub name: String,
    pub notification_type: String,
    pub channel: String,
    pub subject: Option<String>,
    pub template_html: Option<String>,
    pub template_text: Option<String>,
    pub variables: Option<serde_json::Value>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl NotificationTemplate {
    pub fn notification_type(&self) -> Option<NotificationType> {
        NotificationType::from_str(&self.notification_type)
    }

    pub fn channel(&self) -> Option<NotificationChannel> {
        NotificationChannel::from_str(&self.channel)
    }
}

/// Request to create/update template
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateNotificationTemplateRequest {
    pub subject: Option<String>,
    pub template_html: Option<String>,
    pub template_text: Option<String>,
    pub variables: Option<serde_json::Value>,
    pub is_active: Option<bool>,
}

// ============================================================================
// NOTIFICATION DIGESTS
// ============================================================================

/// Digest email batch (daily/weekly summary)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NotificationDigest {
    pub id: Uuid,
    pub user_id: Uuid,
    pub digest_type: String, // daily, weekly
    pub scheduled_for: DateTime<Utc>,
    pub sent_at: Option<DateTime<Utc>>,
    pub status: String,
    pub notification_count: i32,
    pub content: Option<serde_json::Value>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl NotificationDigest {
    pub fn status(&self) -> Option<NotificationStatus> {
        NotificationStatus::from_str(&self.status)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notification_type_conversion() {
        assert_eq!(NotificationType::EventReminder.as_str(), "event_reminder");
        assert_eq!(
            NotificationType::from_str("event_reminder"),
            Some(NotificationType::EventReminder)
        );
    }

    #[test]
    fn test_notification_channel_conversion() {
        assert_eq!(NotificationChannel::Email.as_str(), "email");
        assert_eq!(
            NotificationChannel::from_str("email"),
            Some(NotificationChannel::Email)
        );
    }

    #[test]
    fn test_notification_status_conversion() {
        assert_eq!(NotificationStatus::Pending.as_str(), "pending");
        assert_eq!(
            NotificationStatus::from_str("pending"),
            Some(NotificationStatus::Pending)
        );
    }

    #[test]
    fn test_push_subscription_payload_parsing() {
        let json = r#"
        {
          "endpoint": "https://fcm.googleapis.com/fcm/send/...",
          "expirationTime": null,
          "keys": {
            "p256dh": "key1",
            "auth": "key2"
          }
        }
        "#;

        let payload: PushSubscriptionPayload = serde_json::from_str(json).unwrap();
        assert_eq!(payload.keys.p256dh, "key1");
        assert_eq!(payload.keys.auth, "key2");
    }
}
