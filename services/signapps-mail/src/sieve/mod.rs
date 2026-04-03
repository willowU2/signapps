//! ManageSieve protocol server (RFC 5804).
//!
//! Provides a simple ManageSieve server listening on port 4190 that allows
//! mail clients to manage Sieve scripts for their accounts.
//!
//! ## Supported commands
//!
//! - `AUTHENTICATE PLAIN` — authenticate using SASL PLAIN
//! - `LISTSCRIPTS` — list scripts for the authenticated user
//! - `GETSCRIPT` — download a specific script
//! - `PUTSCRIPT` — upload/create a script
//! - `SETACTIVE` — activate a script
//! - `DELETESCRIPT` — delete a script
//! - `LOGOUT` — terminate the session

pub mod server;
