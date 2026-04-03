//! Pure IMAP4rev2 command parser, response builder, and session state machine.
//!
//! This crate implements IMAP protocol handling without performing any I/O.
//! Network transport is the responsibility of the caller — this library only
//! deals with parsing commands, tracking session state, and generating responses.
//!
//! # Supported Standards
//!
//! - **IMAP4rev2** (RFC 9051): Core protocol
//! - **IDLE** (RFC 2177): Real-time mailbox updates
//! - **NAMESPACE** (RFC 2342): Mailbox namespace discovery
//! - **ID** (RFC 2971): Server/client identification
//! - **SPECIAL-USE** (RFC 6154): Standard mailbox roles
//! - **CONDSTORE** (RFC 7162): Conditional STORE / MODSEQ
//! - **MOVE** (RFC 6851): Atomic move operation
//! - **LITERAL+** (RFC 7888): Non-synchronizing literals
//!
//! # Architecture
//!
//! The crate is organized into four modules:
//!
//! - [`parser`] — Parses raw IMAP command lines into [`ImapCommand`] structs.
//! - [`response`] — Builds IMAP response lines (tagged, untagged, continuation).
//! - [`session`] — State machine tracking connection lifecycle.
//! - [`fetch`] — FETCH item parsing and response construction.
//!
//! # Examples
//!
//! ```
//! use signapps_imap::parser::parse_command;
//! use signapps_imap::session::ImapSession;
//!
//! let mut session = ImapSession::new();
//! let cmd = parse_command("a001 CAPABILITY\r\n").unwrap();
//! let responses = session.process(&cmd);
//! assert!(!responses.is_empty());
//! ```

pub mod fetch;
pub mod parser;
pub mod response;
pub mod session;
