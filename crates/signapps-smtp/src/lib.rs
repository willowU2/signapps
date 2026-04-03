//! Pure SMTP command parser, state machine, and SASL authentication for SignApps Platform.
//!
//! This crate implements SMTP protocol handling without performing any I/O.
//! Network transport is the responsibility of the caller — this library only
//! deals with parsing commands, tracking session state, and generating replies.
//!
//! # Supported Standards
//!
//! - **SMTP** (RFC 5321): EHLO, HELO, MAIL FROM, RCPT TO, DATA, QUIT, RSET, NOOP
//! - **STARTTLS** (RFC 3207): TLS upgrade signaling
//! - **SMTP AUTH** (RFC 4954): SASL PLAIN, LOGIN, XOAUTH2
//! - **SIZE extension** (RFC 1870): message size declaration
//!
//! # Architecture
//!
//! The crate is organized around a [`SmtpSession`] state machine that consumes
//! raw lines and produces [`SmtpAction`] values. The caller reads lines from the
//! network, feeds them into the session, and writes back the resulting replies.
//!
//! # Examples
//!
//! ```
//! use signapps_smtp::{SmtpSession, SmtpConfig, SmtpAction};
//!
//! let config = SmtpConfig {
//!     hostname: "mail.example.com".into(),
//!     max_message_size: 50 * 1024 * 1024,
//!     require_auth: false,
//!     require_tls: false,
//! };
//! let mut session = SmtpSession::new(config);
//!
//! // Get initial greeting
//! let greeting = session.greeting();
//!
//! // Feed an EHLO command
//! let actions = session.feed_line(b"EHLO client.example.com\r\n");
//! ```
#![warn(missing_docs)]

pub mod auth;
pub mod envelope;
pub mod parser;
pub mod reply;
pub mod session;

// ── Re-exports ──────────────────────────────────────────────────────────────

pub use auth::{LoginNext, LoginState, SaslMechanism, SaslPlainCredentials};
pub use envelope::SmtpEnvelope;
pub use parser::{SmtpCommand, SmtpError};
pub use reply::SmtpReply;
pub use session::{SmtpAction, SmtpConfig, SmtpSession, SmtpState};
