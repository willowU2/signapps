//! Notification Scheduler Service
//! Monitors upcoming events and sends reminders based on user preferences
use sqlx::PgPool;
use tokio::time::{interval, Duration as TokioDuration};
use tracing::{debug, error, info};
use uuid::Uuid;

use signapps_db::models::{NotificationChannel, NotificationType};

#[allow(dead_code)]
pub struct SchedulerConfig {
    pub check_interval: TokioDuration,
    #[allow(dead_code)]
    pub reminder_lead_time_minutes: i64,
    #[allow(dead_code)]
    pub batch_size: usize,
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            check_interval: TokioDuration::from_secs(60),
            reminder_lead_time_minutes: 15,
            batch_size: 100,
        }
    }
}

impl SchedulerConfig {
    pub fn new() -> Self {
        Self::default()
    }
}

pub struct NotificationScheduler {
    #[allow(dead_code)]
    pool: PgPool,
    config: SchedulerConfig,
}

impl NotificationScheduler {
    pub fn new(pool: PgPool, config: SchedulerConfig) -> Self {
        Self { pool, config }
    }

    pub async fn run(&self) {
        let mut ticker = interval(self.config.check_interval);

        loop {
            ticker.tick().await;
            if let Err(e) = self.check_and_send_reminders().await {
                error!("Error in notification scheduler: {}", e);
            }
        }
    }

    async fn check_and_send_reminders(&self) -> anyhow::Result<()> {
        debug!("Checking for upcoming events to notify");
        // Logic to fetch events from DB and send notifications
        // This is a simplified version for the implementation phase
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn send_immediate_notification(
        &self,
        _user_id: Uuid,
        _notif_type: NotificationType,
        _channel: NotificationChannel,
        _title: &str,
        _message: &str,
    ) -> anyhow::Result<()> {
        info!("Sending immediate notification to user {}", _user_id);
        // Implementation for immediate sending
        Ok(())
    }
}
