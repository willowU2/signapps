// Enforce documentation on all public items (only during `cargo doc`, not clippy)
#![cfg_attr(doc, warn(missing_docs))]

//! # SignApps DB Notifications
//!
//! Notifications domain database models and repositories for the SignApps Platform.
//!
//! Contains models and repositories for:
//! - Notification preferences (per-user, per-calendar)
//! - Push subscriptions (Web Push / FCM)
//! - Notification templates (email / SMS / push)
//! - Sent notification history
//! - Digest batching
//!
//! This is Phase 4 of the `signapps-db` bounded-context split.
//! See `docs/architecture/refactors/01-split-signapps-db.md`.

pub mod models;
pub mod repositories;

pub use models::notification::*;

pub use repositories::{
    NotificationDigestRepository, NotificationPreferencesRepository, NotificationSentRepository,
    NotificationTemplateRepository, PushSubscriptionRepository,
};
