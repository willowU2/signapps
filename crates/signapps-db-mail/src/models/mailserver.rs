//! Mailserver domain models for the integrated mail/calendar/contacts server.
//!
//! Maps 1:1 to the `mailserver.*` PostgreSQL schema (migration 200).
//! Includes domains, accounts, messages, mailboxes, threads, queue,
//! sieve scripts, CalDAV calendars/events, CardDAV addressbooks/contacts,
//! and DMARC reports.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// Domains
// ============================================================================

/// A mail domain owned by a tenant (e.g. `example.com`).
///
/// Stores DKIM keys, SPF/DMARC policy, and catch-all configuration.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MailDomain {
    /// Unique identifier.
    pub id: Uuid,
    /// Owning tenant.
    pub tenant_id: Option<Uuid>,
    /// Domain name (e.g. `example.com`).
    pub name: String,
    /// PEM-encoded DKIM private key.
    pub dkim_private_key: Option<String>,
    /// DKIM selector (e.g. `default`).
    pub dkim_selector: Option<String>,
    /// DKIM algorithm (`rsa-sha256` or `ed25519-sha256`).
    pub dkim_algorithm: Option<String>,
    /// SPF TXT record value.
    pub spf_record: Option<String>,
    /// DMARC policy: `none`, `quarantine`, or `reject`.
    pub dmarc_policy: Option<String>,
    /// Catch-all forwarding address.
    pub catch_all_address: Option<String>,
    /// Maximum number of accounts allowed (0 = unlimited).
    pub max_accounts: Option<i32>,
    /// Whether DNS records have been verified.
    pub is_verified: Option<bool>,
    /// Whether the domain is active for mail delivery.
    pub is_active: Option<bool>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a new mail domain.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateMailDomain {
    /// Domain name (e.g. `example.com`).
    pub name: String,
    /// Owning tenant.
    pub tenant_id: Option<Uuid>,
    /// Maximum number of accounts allowed.
    pub max_accounts: Option<i32>,
}

/// Request to update a mail domain.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateMailDomain {
    pub dkim_private_key: Option<String>,
    pub dkim_selector: Option<String>,
    pub dkim_algorithm: Option<String>,
    pub spf_record: Option<String>,
    pub dmarc_policy: Option<String>,
    pub catch_all_address: Option<String>,
    pub max_accounts: Option<i32>,
    pub is_verified: Option<bool>,
    pub is_active: Option<bool>,
}

// ============================================================================
// Accounts
// ============================================================================

/// A mail account belonging to a domain (e.g. `user@example.com`).
///
/// Links to an identity user via `user_id` and stores Argon2id password hash
/// for SMTP/IMAP SASL authentication.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MailAccount {
    /// Unique identifier.
    pub id: Uuid,
    /// Parent domain.
    pub domain_id: Uuid,
    /// Linked identity user (optional for service accounts).
    pub user_id: Option<Uuid>,
    /// Full email address (e.g. `user@example.com`).
    pub address: String,
    /// Display name shown in From header.
    pub display_name: Option<String>,
    /// Argon2id password hash for SASL auth.
    pub password_hash: Option<String>,
    /// Storage quota in bytes (default 5 GiB).
    pub quota_bytes: Option<i64>,
    /// Current storage usage in bytes.
    pub used_bytes: Option<i64>,
    /// Whether the account can send/receive mail.
    pub is_active: Option<bool>,
    /// Last successful login timestamp.
    pub last_login: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Request to create a new mail account.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateMailAccount {
    /// Parent domain ID.
    pub domain_id: Uuid,
    /// Linked identity user ID.
    pub user_id: Option<Uuid>,
    /// Full email address.
    pub address: String,
    /// Display name.
    pub display_name: Option<String>,
    /// Argon2id password hash.
    pub password_hash: Option<String>,
    /// Storage quota in bytes.
    pub quota_bytes: Option<i64>,
}

// ============================================================================
// Aliases
// ============================================================================

/// An email alias that forwards to an account.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MailAlias {
    /// Unique identifier.
    pub id: Uuid,
    /// Target account.
    pub account_id: Uuid,
    /// Alias address (e.g. `info@example.com`).
    pub alias_address: String,
    /// Domain the alias belongs to.
    pub domain_id: Uuid,
    /// Whether the alias is active.
    pub is_active: Option<bool>,
}

// ============================================================================
// Message Contents (deduplicated by SHA-256)
// ============================================================================

/// Deduplicated message content stored once per unique SHA-256 hash.
///
/// Contains the parsed MIME structure, full-text search vector,
/// and pgvector embedding for RAG search.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MessageContent {
    /// Unique identifier.
    pub id: Uuid,
    /// SHA-256 hex digest of the raw message.
    pub content_hash: String,
    /// Raw message size in bytes.
    pub raw_size: Option<i64>,
    /// Key in signapps-storage for the raw RFC 5322 message.
    pub storage_key: Option<String>,
    /// Parsed headers as JSON.
    pub headers_json: Option<serde_json::Value>,
    /// Plain-text body.
    pub body_text: Option<String>,
    /// HTML body.
    pub body_html: Option<String>,
    /// MIME tree structure (for IMAP BODYSTRUCTURE).
    pub body_structure: Option<serde_json::Value>,
    // NOTE: text_search (tsvector) and embedding (vector) are DB-only columns;
    // they are not mapped to Rust fields because sqlx does not natively decode
    // tsvector and pgvector types without custom wrappers. They are populated
    // and queried via raw SQL.
    pub created_at: DateTime<Utc>,
}

/// Request to insert a new message content (dedup by hash).
#[derive(Debug, Clone, Deserialize)]
pub struct InsertMessageContent {
    /// SHA-256 hex digest.
    pub content_hash: String,
    /// Raw size in bytes.
    pub raw_size: Option<i64>,
    /// Storage key for the raw message.
    pub storage_key: Option<String>,
    /// Parsed headers.
    pub headers_json: Option<serde_json::Value>,
    /// Plain-text body.
    pub body_text: Option<String>,
    /// HTML body.
    pub body_html: Option<String>,
    /// MIME tree structure.
    pub body_structure: Option<serde_json::Value>,
}

// ============================================================================
// Messages
// ============================================================================

/// A message record linking an account to deduplicated content.
///
/// Contains envelope metadata (sender, recipients, subject, thread)
/// and spam analysis results.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MailMessage {
    /// Unique identifier.
    pub id: Uuid,
    /// Owning account.
    pub account_id: Uuid,
    /// Reference to deduplicated content.
    pub content_id: Uuid,
    /// RFC 5322 Message-ID header.
    pub message_id_header: Option<String>,
    /// In-Reply-To header for threading.
    pub in_reply_to: Option<String>,
    /// Thread identifier.
    pub thread_id: Option<Uuid>,
    /// Sender email address.
    pub sender: Option<String>,
    /// Sender display name.
    pub sender_name: Option<String>,
    /// Recipients as JSON (`{to: [], cc: [], bcc: []}`).
    pub recipients: Option<serde_json::Value>,
    /// Message subject.
    pub subject: Option<String>,
    /// Date header value.
    pub date: Option<DateTime<Utc>>,
    /// Whether the message has attachments.
    pub has_attachments: Option<bool>,
    /// Spam score from the anti-spam pipeline.
    pub spam_score: Option<f64>,
    /// Spam verdict: `ham`, `suspect`, `quarantine`, `reject`.
    pub spam_status: Option<String>,
    /// When the message was received by the server.
    pub received_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Request to insert a new message.
#[derive(Debug, Clone, Deserialize)]
pub struct InsertMailMessage {
    /// Owning account.
    pub account_id: Uuid,
    /// Content reference.
    pub content_id: Uuid,
    /// RFC 5322 Message-ID.
    pub message_id_header: Option<String>,
    /// In-Reply-To header.
    pub in_reply_to: Option<String>,
    /// Thread ID.
    pub thread_id: Option<Uuid>,
    /// Sender address.
    pub sender: Option<String>,
    /// Sender name.
    pub sender_name: Option<String>,
    /// Recipients JSON.
    pub recipients: Option<serde_json::Value>,
    /// Subject.
    pub subject: Option<String>,
    /// Date header.
    pub date: Option<DateTime<Utc>>,
    /// Has attachments flag.
    pub has_attachments: Option<bool>,
    /// Spam score.
    pub spam_score: Option<f64>,
    /// Spam status.
    pub spam_status: Option<String>,
}

// ============================================================================
// Message Mailboxes (N:N join with IMAP UID/MODSEQ/flags)
// ============================================================================

/// Join table placing a message into a mailbox with IMAP metadata.
///
/// Flags bitmask: Seen=1, Answered=2, Flagged=4, Deleted=8, Draft=16.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MessageMailbox {
    /// Message reference.
    pub message_id: Uuid,
    /// Mailbox reference.
    pub mailbox_id: Uuid,
    /// IMAP UID (unique within mailbox).
    pub uid: i32,
    /// IMAP MODSEQ for CONDSTORE/QRESYNC.
    pub modseq: i64,
    /// Flags bitmask.
    pub flags: Option<i32>,
}

/// Request to insert a message into a mailbox.
#[derive(Debug, Clone, Deserialize)]
pub struct InsertMessageMailbox {
    /// Message ID.
    pub message_id: Uuid,
    /// Mailbox ID.
    pub mailbox_id: Uuid,
    /// Flags bitmask.
    pub flags: Option<i32>,
}

// ============================================================================
// Mailboxes
// ============================================================================

/// An IMAP mailbox (folder) belonging to an account.
///
/// Tracks UIDVALIDITY, UID_NEXT, HIGHESTMODSEQ for IMAP protocol compliance.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Mailbox {
    /// Unique identifier.
    pub id: Uuid,
    /// Owning account.
    pub account_id: Uuid,
    /// Display name (e.g. `INBOX`, `Sent`, `Trash`).
    pub name: String,
    /// IMAP special-use attribute (e.g. `\Inbox`, `\Sent`, `\Trash`, `\Drafts`, `\Junk`).
    pub special_use: Option<String>,
    /// IMAP UIDVALIDITY (changes when mailbox is recreated).
    pub uid_validity: i32,
    /// Next UID to assign.
    pub uid_next: Option<i32>,
    /// Highest MODSEQ seen.
    pub highest_modseq: Option<i64>,
    /// Total message count.
    pub total_messages: Option<i32>,
    /// Unread message count.
    pub unread_messages: Option<i32>,
    /// Parent mailbox for hierarchy.
    pub parent_id: Option<Uuid>,
    /// Display sort order.
    pub sort_order: Option<i32>,
    pub created_at: DateTime<Utc>,
}

/// Request to create a new mailbox.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateMailbox {
    /// Owning account.
    pub account_id: Uuid,
    /// Mailbox name.
    pub name: String,
    /// IMAP special-use attribute.
    pub special_use: Option<String>,
    /// Parent mailbox ID.
    pub parent_id: Option<Uuid>,
    /// Sort order.
    pub sort_order: Option<i32>,
}

// ============================================================================
// Attachments
// ============================================================================

/// An attachment linked to a message content record.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MailAttachment {
    /// Unique identifier.
    pub id: Uuid,
    /// Parent message content.
    pub content_id: Uuid,
    /// Original filename.
    pub filename: Option<String>,
    /// MIME content type (e.g. `application/pdf`).
    pub content_type: Option<String>,
    /// Attachment size in bytes.
    pub size: Option<i64>,
    /// Storage key in signapps-storage.
    pub storage_key: Option<String>,
    /// Content disposition (`inline` or `attachment`).
    pub content_disposition: Option<String>,
    /// Content-ID for inline images.
    pub cid: Option<String>,
}

// ============================================================================
// Threads
// ============================================================================

/// A conversation thread grouping related messages.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MailThread {
    /// Unique identifier.
    pub id: Uuid,
    /// Owning account.
    pub account_id: Uuid,
    /// Normalized subject (without Re:/Fwd: prefixes).
    pub subject_base: Option<String>,
    /// Timestamp of the most recent message.
    pub last_message_at: Option<DateTime<Utc>>,
    /// Number of messages in the thread.
    pub message_count: Option<i32>,
    /// Number of unread messages.
    pub unread_count: Option<i32>,
    /// Participant addresses as JSON array.
    pub participants: Option<serde_json::Value>,
}

// ============================================================================
// SMTP Queue
// ============================================================================

/// An outbound message queued for SMTP delivery.
///
/// Status transitions: `queued` -> `sending` -> `sent` | `deferred` -> `bounced`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct QueueEntry {
    /// Unique identifier.
    pub id: Uuid,
    /// Sending account (nullable for system-generated bounces).
    pub account_id: Option<Uuid>,
    /// Envelope MAIL FROM address.
    pub from_address: String,
    /// Envelope RCPT TO addresses as JSON array.
    pub recipients: serde_json::Value,
    /// Storage key for the raw message.
    pub raw_message_key: Option<String>,
    /// Delivery priority (higher = sooner).
    pub priority: Option<i32>,
    /// Delivery status: `queued`, `sending`, `deferred`, `bounced`, `sent`.
    pub status: String,
    /// Number of delivery attempts.
    pub retry_count: Option<i32>,
    /// Next retry timestamp.
    pub next_retry_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    /// When the message was successfully delivered.
    pub sent_at: Option<DateTime<Utc>>,
}

// ============================================================================
// Sieve Scripts
// ============================================================================

/// A Sieve filter script for server-side mail processing (RFC 5228).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct SieveScript {
    /// Unique identifier.
    pub id: Uuid,
    /// Owning account.
    pub account_id: Uuid,
    /// Script name.
    pub name: String,
    /// Sieve source code.
    pub script: String,
    /// Whether this script is the active filter.
    pub is_active: Option<bool>,
    /// Compiled bytecode (for caching).
    pub compiled: Option<Vec<u8>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// Calendar (CalDAV + JMAP)
// ============================================================================

/// A CalDAV calendar owned by a mail account.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CalCalendar {
    /// Unique identifier.
    pub id: Uuid,
    /// Owning mail account.
    pub account_id: Uuid,
    /// Calendar name.
    pub name: String,
    /// Display color (hex, e.g. `#3b82f6`).
    pub color: Option<String>,
    /// Calendar description.
    pub description: Option<String>,
    /// IANA timezone identifier.
    pub timezone: Option<String>,
    /// Collection tag for sync (changes on any modification).
    pub ctag: Option<String>,
    /// Display sort order.
    pub sort_order: Option<i32>,
    /// Whether this is the default calendar.
    pub is_default: Option<bool>,
    pub created_at: DateTime<Utc>,
}

/// A CalDAV event (iCalendar VEVENT).
///
/// The `ical_data` field is the source of truth; structured fields
/// are extracted for indexing and querying.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CalEvent {
    /// Unique identifier.
    pub id: Uuid,
    /// Parent calendar.
    pub calendar_id: Uuid,
    /// iCalendar UID.
    pub uid: String,
    /// Raw iCalendar data (source of truth).
    pub ical_data: Option<String>,
    /// Event summary/title.
    pub summary: Option<String>,
    /// Event description.
    pub description: Option<String>,
    /// Event location.
    pub location: Option<String>,
    /// Start datetime.
    pub dtstart: Option<DateTime<Utc>>,
    /// End datetime.
    pub dtend: Option<DateTime<Utc>>,
    /// Recurrence rule (RFC 5545 RRULE).
    pub rrule: Option<String>,
    /// Organizer email address.
    pub organizer: Option<String>,
    /// Attendees as JSON array.
    pub attendees: Option<serde_json::Value>,
    /// Event status (`CONFIRMED`, `TENTATIVE`, `CANCELLED`).
    pub status: Option<String>,
    /// Transparency (`OPAQUE`, `TRANSPARENT`).
    pub transparency: Option<String>,
    /// Entity tag for conditional requests.
    pub etag: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// Contacts (CardDAV + JMAP)
// ============================================================================

/// A CardDAV address book owned by a mail account.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CardAddressbook {
    /// Unique identifier.
    pub id: Uuid,
    /// Owning mail account.
    pub account_id: Uuid,
    /// Address book name.
    pub name: String,
    /// Description.
    pub description: Option<String>,
    /// Collection tag for sync.
    pub ctag: Option<String>,
    /// Whether this is the default address book.
    pub is_default: Option<bool>,
    pub created_at: DateTime<Utc>,
}

/// A CardDAV contact (vCard).
///
/// The `vcard_data` field is the source of truth; structured fields
/// are extracted for indexing and querying.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CardContact {
    /// Unique identifier.
    pub id: Uuid,
    /// Parent address book.
    pub addressbook_id: Uuid,
    /// vCard UID.
    pub uid: String,
    /// Raw vCard data (source of truth).
    pub vcard_data: Option<String>,
    /// Display name.
    pub display_name: Option<String>,
    /// Email addresses as JSON array.
    pub emails: Option<serde_json::Value>,
    /// Phone numbers as JSON array.
    pub phones: Option<serde_json::Value>,
    /// Organization name.
    pub organization: Option<String>,
    /// Entity tag for conditional requests.
    pub etag: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// DMARC Reports
// ============================================================================

/// An aggregate DMARC report received from a remote domain.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct DmarcReport {
    /// Unique identifier.
    pub id: Uuid,
    /// Domain this report is about.
    pub domain_id: Uuid,
    /// Organization that sent the report.
    pub reporter_org: Option<String>,
    /// Raw XML report data.
    pub report_xml: Option<String>,
    /// Report period start.
    pub date_range_begin: Option<DateTime<Utc>>,
    /// Report period end.
    pub date_range_end: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}
