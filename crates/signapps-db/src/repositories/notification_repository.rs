/// Repository for notification database operations
/// Handles CRUD for preferences, templates, sent notifications

use crate::models::*;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

/// Notification Preferences Repository
pub struct NotificationPreferencesRepository;

impl NotificationPreferencesRepository {
    /// Get preferences for a user (system-wide)
    pub async fn get_by_user(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<NotificationPreferences, sqlx::Error> {
        sqlx::query_as::<_, NotificationPreferences>(
            "SELECT * FROM notification_preferences WHERE user_id = $1 AND calendar_id IS NULL"
        )
        .bind(user_id)
        .fetch_one(pool)
        .await
    }

    /// Get preferences for a user on a specific calendar
    pub async fn get_by_user_and_calendar(
        pool: &PgPool,
        user_id: Uuid,
        calendar_id: Uuid,
    ) -> Result<NotificationPreferences, sqlx::Error> {
        sqlx::query_as::<_, NotificationPreferences>(
            "SELECT * FROM notification_preferences WHERE user_id = $1 AND calendar_id = $2"
        )
        .bind(user_id)
        .bind(calendar_id)
        .fetch_one(pool)
        .await
    }

    /// Create or get default preferences
    pub async fn get_or_create(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<NotificationPreferences, sqlx::Error> {
        // Try to get existing
        if let Ok(prefs) = Self::get_by_user(pool, user_id).await {
            return Ok(prefs);
        }

        // Create default preferences
        let id = Uuid::new_v4();
        sqlx::query_as::<_, NotificationPreferences>(
            r#"
            INSERT INTO notification_preferences
            (id, user_id, email_enabled, email_frequency, sms_enabled, push_enabled)
            VALUES ($1, $2, true, 'instant', false, true)
            RETURNING *
            "#
        )
        .bind(id)
        .bind(user_id)
        .fetch_one(pool)
        .await
    }

    /// Update preferences
    pub async fn update(
        pool: &PgPool,
        user_id: Uuid,
        update: UpdateNotificationPreferencesRequest,
    ) -> Result<NotificationPreferences, sqlx::Error> {
        // Get current preferences
        let current = Self::get_by_user(pool, user_id).await?;

        // Apply updates
        sqlx::query_as::<_, NotificationPreferences>(
            r#"
            UPDATE notification_preferences
            SET
              email_enabled = COALESCE($2, email_enabled),
              email_frequency = COALESCE($3, email_frequency),
              sms_enabled = COALESCE($4, sms_enabled),
              phone_number = COALESCE($5, phone_number),
              push_enabled = COALESCE($6, push_enabled),
              quiet_hours_enabled = COALESCE($7, quiet_hours_enabled),
              quiet_start = COALESCE($8, quiet_start),
              quiet_end = COALESCE($9, quiet_end),
              reminder_times = COALESCE($10, reminder_times),
              updated_at = NOW()
            WHERE user_id = $1 AND calendar_id IS NULL
            RETURNING *
            "#
        )
        .bind(user_id)
        .bind(update.email_enabled)
        .bind(update.email_frequency)
        .bind(update.sms_enabled)
        .bind(update.phone_number)
        .bind(update.push_enabled)
        .bind(update.quiet_hours_enabled)
        .bind(update.quiet_start)
        .bind(update.quiet_end)
        .bind(update.reminder_times)
        .fetch_one(pool)
        .await
    }

    /// Delete preferences
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM notification_preferences WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }
}

/// Push Subscription Repository
pub struct PushSubscriptionRepository;

impl PushSubscriptionRepository {
    /// Create push subscription
    pub async fn create(
        pool: &PgPool,
        user_id: Uuid,
        subscription_json: serde_json::Value,
        browser_name: Option<String>,
    ) -> Result<PushSubscription, sqlx::Error> {
        let id = Uuid::new_v4();
        sqlx::query_as::<_, PushSubscription>(
            r#"
            INSERT INTO push_subscriptions
            (id, user_id, subscription_json, browser_name)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#
        )
        .bind(id)
        .bind(user_id)
        .bind(subscription_json)
        .bind(browser_name)
        .fetch_one(pool)
        .await
    }

    /// Get all subscriptions for a user
    pub async fn get_by_user(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Vec<PushSubscription>, sqlx::Error> {
        sqlx::query_as::<_, PushSubscription>(
            "SELECT * FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC"
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
    }

    /// Delete subscription
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM push_subscriptions WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }

    /// Delete expired subscriptions (for cleanup job)
    pub async fn delete_old(pool: &PgPool, days: i32) -> Result<u64, sqlx::Error> {
        let result = sqlx::query(
            "DELETE FROM push_subscriptions WHERE created_at < NOW() - INTERVAL '1 day' * $1"
        )
        .bind(days)
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }
}

/// Notification Sent Repository (Audit Log)
pub struct NotificationSentRepository;

impl NotificationSentRepository {
    /// Create notification record
    pub async fn create(
        pool: &PgPool,
        user_id: Uuid,
        event_id: Option<Uuid>,
        task_id: Option<Uuid>,
        notification_type: &str,
        channel: &str,
        recipient_address: Option<&str>,
    ) -> Result<NotificationSent, sqlx::Error> {
        let id = Uuid::new_v4();
        sqlx::query_as::<_, NotificationSent>(
            r#"
            INSERT INTO notifications_sent
            (id, user_id, event_id, task_id, notification_type, channel, recipient_address, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
            RETURNING *
            "#
        )
        .bind(id)
        .bind(user_id)
        .bind(event_id)
        .bind(task_id)
        .bind(notification_type)
        .bind(channel)
        .bind(recipient_address)
        .fetch_one(pool)
        .await
    }

    /// Get notification by ID
    pub async fn get_by_id(pool: &PgPool, id: Uuid) -> Result<NotificationSent, sqlx::Error> {
        sqlx::query_as::<_, NotificationSent>(
            "SELECT * FROM notifications_sent WHERE id = $1"
        )
        .bind(id)
        .fetch_one(pool)
        .await
    }

    /// Update notification status
    pub async fn update_status(
        pool: &PgPool,
        id: Uuid,
        status: &str,
        external_id: Option<&str>,
    ) -> Result<NotificationSent, sqlx::Error> {
        sqlx::query_as::<_, NotificationSent>(
            r#"
            UPDATE notifications_sent
            SET status = $2, sent_at = NOW(), external_id = COALESCE($3, external_id)
            WHERE id = $1
            RETURNING *
            "#
        )
        .bind(id)
        .bind(status)
        .bind(external_id)
        .fetch_one(pool)
        .await
    }

    /// Mark as delivered (for push notifications)
    pub async fn mark_delivered(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE notifications_sent SET status = 'delivered', delivered_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }

    /// Mark as read
    pub async fn mark_read(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE notifications_sent SET status = 'read', read_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }

    /// Mark as failed
    pub async fn mark_failed(
        pool: &PgPool,
        id: Uuid,
        error: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE notifications_sent
            SET status = 'failed', failed_at = NOW(), error_message = $2, retry_count = retry_count + 1
            WHERE id = $1
            "#
        )
        .bind(id)
        .bind(error)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Get pending notifications (for scheduler)
    pub async fn get_pending(pool: &PgPool, limit: i32) -> Result<Vec<NotificationSent>, sqlx::Error> {
        sqlx::query_as::<_, NotificationSent>(
            r#"
            SELECT * FROM notifications_sent
            WHERE status = 'pending' AND retry_count < 3
            ORDER BY created_at ASC
            LIMIT $1
            "#
        )
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    /// Get notification history for user
    pub async fn get_history(
        pool: &PgPool,
        user_id: Uuid,
        limit: i32,
        offset: i32,
    ) -> Result<Vec<NotificationSent>, sqlx::Error> {
        sqlx::query_as::<_, NotificationSent>(
            r#"
            SELECT * FROM notifications_sent
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
    }

    /// Count notifications by status
    pub async fn count_by_status(
        pool: &PgPool,
        user_id: Uuid,
        status: &str,
    ) -> Result<i64, sqlx::Error> {
        let result = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM notifications_sent WHERE user_id = $1 AND status = $2"
        )
        .bind(user_id)
        .bind(status)
        .fetch_one(pool)
        .await?;
        Ok(result)
    }

    /// Delete old notifications (for archival)
    pub async fn delete_old(pool: &PgPool, days: i32) -> Result<u64, sqlx::Error> {
        let result = sqlx::query(
            "DELETE FROM notifications_sent WHERE created_at < NOW() - INTERVAL '1 day' * $1"
        )
        .bind(days)
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }
}

/// Notification Template Repository
pub struct NotificationTemplateRepository;

impl NotificationTemplateRepository {
    /// Get template by type and channel
    pub async fn get_by_type_channel(
        pool: &PgPool,
        notification_type: &str,
        channel: &str,
    ) -> Result<NotificationTemplate, sqlx::Error> {
        sqlx::query_as::<_, NotificationTemplate>(
            r#"
            SELECT * FROM notification_templates
            WHERE notification_type = $1 AND channel = $2 AND is_active = true
            "#
        )
        .bind(notification_type)
        .bind(channel)
        .fetch_one(pool)
        .await
    }

    /// Get all active templates
    pub async fn get_active(pool: &PgPool) -> Result<Vec<NotificationTemplate>, sqlx::Error> {
        sqlx::query_as::<_, NotificationTemplate>(
            "SELECT * FROM notification_templates WHERE is_active = true ORDER BY name"
        )
        .fetch_all(pool)
        .await
    }

    /// Update template
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        update: UpdateNotificationTemplateRequest,
    ) -> Result<NotificationTemplate, sqlx::Error> {
        sqlx::query_as::<_, NotificationTemplate>(
            r#"
            UPDATE notification_templates
            SET
              subject = COALESCE($2, subject),
              template_html = COALESCE($3, template_html),
              template_text = COALESCE($4, template_text),
              variables = COALESCE($5, variables),
              is_active = COALESCE($6, is_active),
              updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#
        )
        .bind(id)
        .bind(update.subject)
        .bind(update.template_html)
        .bind(update.template_text)
        .bind(update.variables)
        .bind(update.is_active)
        .fetch_one(pool)
        .await
    }
}

/// Notification Digest Repository
pub struct NotificationDigestRepository;

impl NotificationDigestRepository {
    /// Create digest batch
    pub async fn create(
        pool: &PgPool,
        user_id: Uuid,
        digest_type: &str,
        scheduled_for: DateTime<Utc>,
    ) -> Result<NotificationDigest, sqlx::Error> {
        let id = Uuid::new_v4();
        sqlx::query_as::<_, NotificationDigest>(
            r#"
            INSERT INTO notification_digests
            (id, user_id, digest_type, scheduled_for, status)
            VALUES ($1, $2, $3, $4, 'pending')
            RETURNING *
            "#
        )
        .bind(id)
        .bind(user_id)
        .bind(digest_type)
        .bind(scheduled_for)
        .fetch_one(pool)
        .await
    }

    /// Get pending digests
    pub async fn get_pending(pool: &PgPool) -> Result<Vec<NotificationDigest>, sqlx::Error> {
        sqlx::query_as::<_, NotificationDigest>(
            r#"
            SELECT * FROM notification_digests
            WHERE status = 'pending' AND scheduled_for <= NOW()
            ORDER BY scheduled_for ASC
            "#
        )
        .fetch_all(pool)
        .await
    }

    /// Update digest status
    pub async fn update_status(
        pool: &PgPool,
        id: Uuid,
        status: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE notification_digests SET status = $2, sent_at = NOW() WHERE id = $1"
        )
        .bind(id)
        .bind(status)
        .execute(pool)
        .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notification_repository_types() {
        // This is just a compile-time check that the repository types exist
        let _ = std::any::type_name::<NotificationPreferencesRepository>();
        let _ = std::any::type_name::<PushSubscriptionRepository>();
        let _ = std::any::type_name::<NotificationSentRepository>();
        let _ = std::any::type_name::<NotificationTemplateRepository>();
        let _ = std::any::type_name::<NotificationDigestRepository>();
    }
}
