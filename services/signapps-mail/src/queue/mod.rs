//! Outbound mail queue for the mail server.
//!
//! The queue worker picks up messages from `mailserver.queue`, resolves MX
//! records for recipient domains, and delivers them via SMTP to remote servers.
//!
//! Messages that fail with temporary errors (4xx) are retried with exponential
//! backoff. Permanent failures (5xx) generate bounce notifications. After 72
//! hours of retries, messages are marked as bounced.

pub mod worker;
