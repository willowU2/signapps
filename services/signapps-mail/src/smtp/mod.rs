//! SMTP server listeners for the mail service.
//!
//! Three modules are provided:
//! - [`inbound`]: Port 25 — accepts incoming email from remote MTAs.
//! - [`submission`]: Port 587 — accepts outgoing email from authenticated users.
//! - [`delivery`]: Local delivery logic — MIME parsing, DB persistence, NOTIFY.

pub mod delivery;
pub mod inbound;
pub mod submission;
