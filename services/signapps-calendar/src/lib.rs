//! signapps-calendar library target.
//!
//! Exposes the pure business-logic modules for integration testing.
//! No database I/O or Axum state is required by these modules.

mod error;
pub use error::CalendarError;

pub mod services {
    //! Pure domain service modules — no DB, no HTTP.

    pub mod booking;
    pub mod icalendar;
    pub mod presence;
    pub mod recurrence;
    pub mod task_tree;
}
