//! Notifications domain repositories.

pub mod notification_repository;

pub use notification_repository::{
    NotificationDigestRepository, NotificationPreferencesRepository, NotificationSentRepository,
    NotificationTemplateRepository, PushSubscriptionRepository,
};
