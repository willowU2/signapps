//! Calendar service domain services

pub mod booking;
pub mod icalendar;
pub mod presence;
pub mod push_service;
#[allow(dead_code)]
pub mod recurrence;
pub mod task_tree;
#[allow(dead_code)]
pub mod timezone;
// pub mod email_service;  // TODO: Fix OpenSSL dependency on Windows
pub mod notification_scheduler;

pub use notification_scheduler::{NotificationScheduler, SchedulerConfig};
pub use push_service::{get_vapid_public_key, send_push_notification, PushNotificationPayload};
pub use recurrence::*;
pub use timezone::*;
