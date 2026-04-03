//! SMTP server listeners for the mail service.
//!
//! Two listeners are provided:
//! - [`inbound`]: Port 25 — accepts incoming email from remote MTAs.
//! - [`submission`]: Port 587 — accepts outgoing email from authenticated users.

pub mod inbound;
pub mod submission;
