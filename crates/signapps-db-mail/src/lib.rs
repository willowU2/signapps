// Enforce documentation on all public items (only during `cargo doc`, not clippy)
#![cfg_attr(doc, warn(missing_docs))]

//! # SignApps DB Mail
//!
//! Mail domain database models and repositories for the SignApps Platform.
//!
//! Contains models and repositories for:
//! - Mail domains, accounts, aliases
//! - IMAP mailboxes, messages, threads, queue
//! - Sieve scripts (server-side filtering)
//! - CalDAV calendars and events
//! - CardDAV address books and contacts
//! - DMARC reports
//!
//! This is Phase 4 of the `signapps-db` bounded-context split.
//! See `docs/architecture/refactors/01-split-signapps-db.md`.

pub mod models;
pub mod repositories;

pub use models::mailserver::*;

pub use repositories::{AccountRepository, DomainRepository, MailboxRepository, MessageRepository};
