//! Per-connection IMAP state with database access.
//!
//! [`ImapConnectionState`] wraps the PostgreSQL pool and tracks the
//! authenticated account and selected mailbox for a single IMAP client
//! connection.

use sqlx::{Pool, Postgres};
use uuid::Uuid;

/// Per-connection state for an IMAP client.
///
/// Each accepted TCP connection gets its own instance. Contains the shared
/// database pool and mutable connection-specific state (authenticated account,
/// selected mailbox).
///
/// # Examples
///
/// ```ignore
/// let conn = ImapConnectionState::new(pool.clone());
/// assert!(conn.account().is_none());
/// ```
#[derive(Debug, Clone)]
pub struct ImapConnectionState {
    /// Shared PostgreSQL connection pool.
    pool: Pool<Postgres>,
    /// The authenticated mail account, set after successful LOGIN.
    account: Option<MailAccountInfo>,
    /// The currently selected mailbox, set after successful SELECT/EXAMINE.
    selected_mailbox: Option<SelectedMailbox>,
}

/// Minimal account info cached for the duration of the connection.
///
/// Extracted from `mailserver.accounts` after LOGIN.
#[derive(Debug, Clone)]
pub struct MailAccountInfo {
    /// Account UUID from `mailserver.accounts.id`.
    pub id: Uuid,
    /// Email address (e.g. `user@example.com`).
    pub address: String,
    /// Optional display name.
    pub display_name: Option<String>,
}

/// State for the currently selected mailbox.
///
/// Populated after a successful SELECT or EXAMINE command.
#[derive(Debug, Clone)]
pub struct SelectedMailbox {
    /// Mailbox UUID from `mailserver.mailboxes.id`.
    pub id: Uuid,
    /// Mailbox name (e.g. `"INBOX"`, `"Sent"`).
    pub name: String,
    /// UIDVALIDITY value for this mailbox.
    pub uid_validity: i32,
    /// Next UID to be assigned.
    pub uid_next: i32,
    /// Whether the mailbox was opened read-only (via EXAMINE).
    pub readonly: bool,
    /// Total message count at time of SELECT.
    pub total_messages: i32,
    /// Unread message count at time of SELECT.
    pub unread_messages: i32,
    /// Highest modification sequence number.
    pub highest_modseq: i64,
}

impl ImapConnectionState {
    /// Create a new connection state with the given database pool.
    ///
    /// # Panics
    ///
    /// This function does not panic.
    pub fn new(pool: Pool<Postgres>) -> Self {
        Self {
            pool,
            account: None,
            selected_mailbox: None,
        }
    }

    /// Returns a reference to the database pool.
    pub fn pool(&self) -> &Pool<Postgres> {
        &self.pool
    }

    /// Returns the authenticated account, if any.
    pub fn account(&self) -> Option<&MailAccountInfo> {
        self.account.as_ref()
    }

    /// Set the authenticated account after successful LOGIN.
    pub fn set_account(&mut self, account: MailAccountInfo) {
        self.account = Some(account);
    }

    /// Returns the selected mailbox, if any.
    pub fn selected_mailbox(&self) -> Option<&SelectedMailbox> {
        self.selected_mailbox.as_ref()
    }

    /// Set the selected mailbox after successful SELECT/EXAMINE.
    pub fn set_selected_mailbox(&mut self, mailbox: SelectedMailbox) {
        self.selected_mailbox = Some(mailbox);
    }

    /// Clear the selected mailbox (CLOSE / UNSELECT).
    pub fn clear_selected_mailbox(&mut self) {
        self.selected_mailbox = None;
    }
}
