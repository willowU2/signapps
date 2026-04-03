//! IMAP4rev2 server for the mail service.
//!
//! Provides a full IMAP server on port 993 backed by the `mailserver.*`
//! PostgreSQL schema. Uses the `signapps-imap` crate for protocol parsing
//! and the local modules for database-backed command execution.
//!
//! ## Modules
//!
//! - [`server`] — TCP listener and per-connection dispatch loop.
//! - [`session`] — Per-connection state with database access.
//! - [`commands`] — Command handlers (LOGIN, SELECT, FETCH, SEARCH, STORE, etc.).
//! - [`idle`] — IMAP IDLE via PostgreSQL LISTEN/NOTIFY.

pub mod commands;
pub mod idle;
pub mod server;
pub mod session;
