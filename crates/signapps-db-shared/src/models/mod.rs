//! Shared database models extracted from `signapps-db`.

pub mod activity;
pub mod entity_reference;
pub mod job;
pub mod resource_booking;
pub mod tenant;

pub use activity::*;
pub use entity_reference::*;
pub use job::*;
pub use resource_booking::*;
pub use tenant::*;
