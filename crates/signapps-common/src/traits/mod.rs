//! Shared traits used across SignApps services.

/// Database crawling trait for extracting and ingesting records into the AI pipeline.
pub mod crawler;
pub use crawler::*;

/// Cross-service entity linking and persistent audit/activity logging.
pub mod linkable;
pub use linkable::{audit, log_activity, Linkable};
