//! Calendar service domain services

pub mod recurrence;
pub mod timezone;
pub mod task_tree;
pub mod booking;
pub mod icalendar;
pub mod presence;
// pub mod email_service;  // TODO: Fix OpenSSL dependency on Windows
pub mod notification_scheduler;

pub use recurrence::*;
pub use timezone::*;
pub use task_tree::*;
pub use booking::*;
pub use icalendar::*;
pub use presence::*;
// pub use email_service::EmailService;  // TODO: Fix OpenSSL dependency
pub use notification_scheduler::{NotificationScheduler, SchedulerConfig};
