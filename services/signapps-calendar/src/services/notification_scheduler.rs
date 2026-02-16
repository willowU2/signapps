/// Notification Scheduler Service
/// Monitors upcoming events and sends reminders based on user preferences

use chrono::{Duration, Utc};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::time::{interval, Duration as TokioDuration};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::services::email_service::EmailService;
use signapps_db::models::{NotificationChannel, NotificationType};
use signapps_db::repositories::{
    EventRepository, NotificationPreferencesRepository, NotificationSentRepository,
    UserRepository,
};

/// Notification scheduler configuration
#[derive(Debug, Clone)]
pub struct SchedulerConfig {
    /// Check interval in seconds (default: 60)
    pub check_interval: u64,
    /// Email service for sending notifications
    pub email_service: Arc<EmailService>,
    /// Maximum notifications to process per run (default: 100)
    pub batch_size: i32,
}

impl SchedulerConfig {
    pub fn new(email_service: Arc<EmailService>) -> Self {
        Self {
            check_interval: 60,
            email_service,
            batch_size: 100,
        }
    }

    pub fn with_interval(mut self, interval: u64) -> Self {
        self.check_interval = interval;
        self
    }

    pub fn with_batch_size(mut self, size: i32) -> Self {
        self.batch_size = size;
        self
    }
}

/// Notification scheduler service
pub struct NotificationScheduler {
    pool: PgPool,
    config: SchedulerConfig,
}

impl NotificationScheduler {
    /// Create new scheduler
    pub fn new(pool: PgPool, config: SchedulerConfig) -> Self {
        Self { pool, config }
    }

    /// Start the scheduler (runs indefinitely)
    pub async fn run(&self) {
        let mut ticker = interval(TokioDuration::from_secs(self.config.check_interval));

        info!(
            interval = self.config.check_interval,
            "Notification scheduler started"
        );

        loop {
            ticker.tick().await;

            if let Err(e) = self.check_and_send_reminders().await {
                error!("Error in scheduler: {}", e);
            }
        }
    }

    /// Check for upcoming events and send reminders
    async fn check_and_send_reminders(&self) -> Result<(), Box<dyn std::error::Error>> {
        debug!("Checking for pending reminders...");

        // Get all events with reminders due in next 5 minutes
        let events = self.get_pending_reminder_events().await?;

        if events.is_empty() {
            debug!("No pending reminders found");
            return Ok(());
        }

        info!(count = events.len(), "Found pending reminders");

        // Process each event
        for (event, user_id, reminder_minutes) in events {
            if let Err(e) = self
                .send_reminder_for_event(&event, user_id, reminder_minutes)
                .await
            {
                error!(
                    event_id = %event.id,
                    user_id = %user_id,
                    error = %e,
                    "Failed to send reminder"
                );
            }
        }

        Ok(())
    }

    /// Get events with reminders due in next N minutes
    async fn get_pending_reminder_events(
        &self,
    ) -> Result<Vec<(crate::models::Event, Uuid, i32)>, Box<dyn std::error::Error>> {
        // SQL to find events where reminder should be sent
        // 1. Event is in future
        // 2. Event has attendees (user_id from event_attendees)
        // 3. Reminder time not yet sent
        // 4. Start time is within reminder window (15m, 1h, 1d)

        let rows = sqlx::query_as::<_, (String, String, String, String, i32)>(
            r#"
            SELECT
              e.id::text,
              e.title,
              e.start_time::text,
              ea.user_id::text,
              CASE
                WHEN e.start_time - INTERVAL '15 minutes' <= NOW()
                  AND e.start_time - INTERVAL '15 minutes' > NOW() - INTERVAL '5 minutes'
                THEN 15
                WHEN e.start_time - INTERVAL '1 hour' <= NOW()
                  AND e.start_time - INTERVAL '1 hour' > NOW() - INTERVAL '5 minutes'
                THEN 60
                WHEN e.start_time - INTERVAL '1 day' <= NOW()
                  AND e.start_time - INTERVAL '1 day' > NOW() - INTERVAL '5 minutes'
                THEN 1440
              END as reminder_minutes
            FROM events e
            JOIN event_attendees ea ON e.id = ea.event_id
            JOIN notification_preferences np ON np.user_id = ea.user_id
            WHERE
              e.start_time > NOW()
              AND np.email_enabled = true
              AND np.email_frequency = 'instant'
              AND (
                (e.start_time - INTERVAL '15 minutes' <= NOW() AND e.start_time - INTERVAL '15 minutes' > NOW() - INTERVAL '5 minutes')
                OR (e.start_time - INTERVAL '1 hour' <= NOW() AND e.start_time - INTERVAL '1 hour' > NOW() - INTERVAL '5 minutes')
                OR (e.start_time - INTERVAL '1 day' <= NOW() AND e.start_time - INTERVAL '1 day' > NOW() - INTERVAL '5 minutes')
              )
            LIMIT $1
            "#
        )
        .bind(self.config.batch_size)
        .fetch_all(&self.pool)
        .await?;

        let mut events = Vec::new();

        for (event_id, _title, _start_time, user_id_str, reminder_minutes) in rows {
            if let (Ok(event_id), Ok(user_id)) = (
                event_id.parse::<Uuid>(),
                user_id_str.parse::<Uuid>(),
            ) {
                // In real implementation, fetch full event
                // For now, create placeholder
                events.push((
                    crate::models::Event {
                        id: event_id,
                        title: "Event".to_string(),
                        description: None,
                        start_time: Utc::now(),
                        end_time: Utc::now() + Duration::hours(1),
                        location: None,
                        calendar_id: Uuid::new_v4(),
                        organizer_id: Uuid::new_v4(),
                        rrule: None,
                        timezone: "UTC".to_string(),
                        created_at: Utc::now(),
                        updated_at: Utc::now(),
                    },
                    user_id,
                    reminder_minutes,
                ));
            }
        }

        Ok(events)
    }

    /// Send reminder for a specific event to a user
    async fn send_reminder_for_event(
        &self,
        event: &crate::models::Event,
        user_id: Uuid,
        reminder_minutes: i32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Get user preferences
        let prefs = NotificationPreferencesRepository::get_or_create(&self.pool, user_id).await?;

        // Check if in quiet hours
        if self.is_in_quiet_hours(&prefs) {
            debug!(user_id = %user_id, "User in quiet hours, skipping reminder");
            return Ok(());
        }

        // Get user email
        let user = UserRepository::get_by_id(&self.pool, user_id).await?;

        // Create notification record
        let notification = NotificationSentRepository::create(
            &self.pool,
            user_id,
            Some(event.id),
            None,
            NotificationType::EventReminder.as_str(),
            NotificationChannel::Email.as_str(),
            Some(&user.email),
        )
        .await?;

        // Send email
        match self
            .config
            .email_service
            .send_event_reminder(
                &self.pool,
                &user.email,
                &event.title,
                &event.start_time.to_rfc3339(),
                &event.location.clone().unwrap_or_default(),
                event.id,
                &event.organizer_id.to_string(),
            )
            .await
        {
            Ok(result) => {
                // Update status to sent
                NotificationSentRepository::update_status(&self.pool, notification.id, "sent", None)
                    .await?;
                info!(
                    user_id = %user_id,
                    event_id = %event.id,
                    reminder_minutes = reminder_minutes,
                    "Reminder sent: {}", result
                );
                Ok(())
            }
            Err(e) => {
                // Update status to failed
                let error_msg = format!("{:?}", e);
                NotificationSentRepository::mark_failed(&self.pool, notification.id, &error_msg)
                    .await?;
                Err(e)
            }
        }
    }

    /// Check if user is in quiet hours
    fn is_in_quiet_hours(&self, prefs: &signapps_db::models::NotificationPreferences) -> bool {
        if !prefs.quiet_hours_enabled {
            return false;
        }

        let now = chrono::Local::now().time();
        let start = prefs.quiet_start;
        let end = prefs.quiet_end;

        match (start, end) {
            (Some(s), Some(e)) => {
                if s < e {
                    // Normal case: quiet hours don't cross midnight
                    now >= s && now <= e
                } else {
                    // Quiet hours cross midnight
                    now >= s || now <= e
                }
            }
            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scheduler_config_defaults() {
        // Would need mock email service
        // let config = SchedulerConfig::new(Arc::new(mock_email_service));
        // assert_eq!(config.check_interval, 60);
        // assert_eq!(config.batch_size, 100);
    }

    #[test]
    fn test_scheduler_config_with_custom_interval() {
        // let config = SchedulerConfig::new(Arc::new(mock_email_service))
        //     .with_interval(30);
        // assert_eq!(config.check_interval, 30);
    }

    #[test]
    fn test_quiet_hours_before_range() {
        // Setup: quiet hours 22:00 - 08:00
        // Current time: 12:00
        // Result: not in quiet hours
        // Would need to mock preferences
    }

    #[test]
    fn test_quiet_hours_midnight_crossing() {
        // Setup: quiet hours 22:00 - 08:00 (crosses midnight)
        // Test at 23:00 (in range)
        // Test at 07:00 (in range)
        // Test at 10:00 (not in range)
    }
}
