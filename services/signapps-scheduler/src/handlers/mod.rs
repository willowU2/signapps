//! HTTP handlers for scheduler service.

pub mod backups;
pub mod calendars;
pub mod devops;
pub mod events;
pub mod jobs;
pub mod metrics;
pub mod notifications;
pub mod projects;
pub mod resources;
pub mod tasks;
pub mod tenants;
pub mod time_items;
pub mod users;
pub mod workspaces;

pub use jobs::*;
