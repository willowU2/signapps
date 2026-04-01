use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize, Serializer};
use uuid::Uuid;

/// Helper: serialize `oauth_token` as `has_oauth_token: bool`.
fn serialize_has_oauth_token<S>(token: &Option<String>, s: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    s.serialize_bool(token.is_some())
}

/// Represents a mail account configured for a user.
///
/// Supports IMAP/SMTP with password or OAuth2 authentication.
/// Each user can have multiple accounts (Gmail, Outlook, custom).
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct MailAccount {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Owner of this mail account.
    pub user_id: Uuid,
    /// Email address (e.g. `user@gmail.com`).
    pub email_address: String,
    /// Human-readable display name for the account.
    pub display_name: Option<String>,
    /// Provider slug: `"google"`, `"microsoft"`, or `"custom"`.
    pub provider: String,

    // IMAP
    /// IMAP server hostname (e.g. `imap.gmail.com`).
    pub imap_server: Option<String>,
    /// IMAP server port (default 993 for TLS).
    pub imap_port: Option<i32>,
    /// Whether to use TLS for the IMAP connection.
    pub imap_use_tls: Option<bool>,

    // SMTP
    /// SMTP server hostname (e.g. `smtp.gmail.com`).
    pub smtp_server: Option<String>,
    /// SMTP server port (default 587 for STARTTLS, 465 for implicit TLS).
    pub smtp_port: Option<i32>,
    /// Whether to use TLS for the SMTP connection.
    pub smtp_use_tls: Option<bool>,

    // Auth
    /// App-specific password (never serialized to the client).
    #[serde(skip_serializing)]
    pub app_password: Option<String>,
    /// OAuth2 access token. Serialized as `has_oauth_token: bool` — never exposes the raw token.
    #[serde(
        serialize_with = "serialize_has_oauth_token",
        rename = "has_oauth_token"
    )]
    pub oauth_token: Option<String>,
    /// OAuth2 refresh token (never serialized to the client).
    #[serde(skip_serializing)]
    pub oauth_refresh_token: Option<String>,
    /// Expiration timestamp of the current OAuth2 access token.
    pub oauth_expires_at: Option<DateTime<Utc>>,

    // Sync
    /// Account status: `"active"`, `"error"`, or `"disabled"`.
    pub status: Option<String>,
    /// Timestamp of the last successful IMAP sync.
    pub last_sync_at: Option<DateTime<Utc>>,
    /// Human-readable description of the last sync error, if any.
    pub last_error: Option<String>,
    /// Polling interval for periodic sync (minutes). Defaults to 5.
    pub sync_interval_minutes: Option<i32>,

    // Signature
    /// HTML email signature appended to outgoing messages.
    pub signature_html: Option<String>,
    /// Plain-text email signature appended to outgoing messages.
    pub signature_text: Option<String>,

    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
    /// Row last-update timestamp.
    pub updated_at: Option<DateTime<Utc>>,
}

/// Represents an IMAP mail folder (a.k.a. mailbox).
///
/// Folders are discovered during IMAP LIST and kept in sync.
/// Standard types: `inbox`, `sent`, `drafts`, `trash`, `spam`, `archive`, `custom`.
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct MailFolder {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Parent mail account.
    pub account_id: Uuid,
    /// Display name shown in the UI (e.g. "Inbox", "Sent").
    pub name: String,
    /// Canonical folder type: `inbox`, `sent`, `drafts`, `trash`, `spam`, `archive`, `custom`.
    pub folder_type: String,
    /// Raw IMAP path as returned by the server (e.g. `[Gmail]/Sent Mail`).
    pub imap_path: Option<String>,
    /// Number of unread messages in this folder.
    pub unread_count: Option<i32>,
    /// Total number of messages in this folder.
    pub total_count: Option<i32>,
    /// Parent folder id for nested IMAP hierarchies.
    pub parent_id: Option<Uuid>,
    /// Highest IMAP UID successfully synced for incremental sync.
    pub last_synced_uid: Option<i64>,
    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
    /// Row last-update timestamp.
    pub updated_at: Option<DateTime<Utc>>,
}

/// Represents a single email message stored in the database.
///
/// Emails are synced from IMAP or created locally as drafts.
/// Threading is handled via `message_id` / `in_reply_to` / `thread_id`.
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Email {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Mail account this email belongs to.
    pub account_id: Uuid,
    /// Folder containing this email.
    pub folder_id: Option<Uuid>,

    /// RFC 2822 `Message-ID` header for threading.
    pub message_id: Option<String>,
    /// RFC 2822 `In-Reply-To` header for threading.
    pub in_reply_to: Option<String>,
    /// Internal thread identifier grouping related messages.
    pub thread_id: Option<Uuid>,
    /// IMAP UID used for incremental sync.
    pub imap_uid: Option<i64>,

    /// Sender email address (RFC 5322 `From`).
    pub sender: String,
    /// Display name of the sender, if available.
    pub sender_name: Option<String>,
    /// Primary recipient email address(es) (comma-separated).
    pub recipient: String,
    /// Carbon-copy recipient(s).
    pub cc: Option<String>,
    /// Blind carbon-copy recipient(s).
    pub bcc: Option<String>,
    /// Reply-to address override.
    pub reply_to: Option<String>,
    /// Email subject line.
    pub subject: Option<String>,

    /// Plain-text body content.
    pub body_text: Option<String>,
    /// HTML body content.
    pub body_html: Option<String>,
    /// Short preview snippet (first ~100 chars of body).
    pub snippet: Option<String>,

    /// Whether the email has been read by the user.
    pub is_read: Option<bool>,
    /// Whether the email is starred / flagged.
    pub is_starred: Option<bool>,
    /// Whether the email is marked as important.
    pub is_important: Option<bool>,
    /// Whether the email is a draft.
    pub is_draft: Option<bool>,
    /// Whether the email was sent by the user.
    pub is_sent: Option<bool>,
    /// Whether the email has been archived.
    pub is_archived: Option<bool>,
    /// Whether the email has been soft-deleted (moved to trash).
    pub is_deleted: Option<bool>,

    /// User-assigned label names for categorization.
    pub labels: Option<Vec<String>>,
    /// Timestamp when the snoozed email should reappear.
    pub snoozed_until: Option<DateTime<Utc>>,
    /// Timestamp when a scheduled email should be sent.
    pub scheduled_send_at: Option<DateTime<Utc>>,

    /// Timestamp when the email was received (IMAP INTERNALDATE).
    pub received_at: Option<DateTime<Utc>>,
    /// Timestamp when the email was sent.
    pub sent_at: Option<DateTime<Utc>>,
    /// Size of the email in bytes (including headers).
    pub size_bytes: Option<i32>,
    /// Whether the email has file attachments.
    pub has_attachments: Option<bool>,

    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
    /// Row last-update timestamp.
    pub updated_at: Option<DateTime<Utc>>,
}

/// Represents a file attachment linked to an email.
///
/// Attachments can be regular (downloadable) or inline (embedded in the HTML body
/// via `Content-ID`). Files are stored externally; `storage_bucket` and
/// `storage_key` point to the backing store (filesystem or S3).
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Attachment {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Parent email this attachment belongs to.
    pub email_id: Uuid,
    /// Original filename as provided by the sender.
    pub filename: String,
    /// MIME type (e.g. `application/pdf`, `image/png`).
    pub mime_type: Option<String>,
    /// File size in bytes.
    pub size_bytes: Option<i64>,
    /// RFC 2392 `Content-ID` for inline attachments referenced in HTML body.
    pub content_id: Option<String>,
    /// Whether this attachment is inline (embedded in the HTML body).
    pub is_inline: Option<bool>,
    /// Storage backend bucket name.
    pub storage_bucket: Option<String>,
    /// Storage backend object key / path.
    pub storage_key: Option<String>,
    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
}

/// Represents a user-defined label for categorizing emails.
///
/// Labels are per-account and can have an optional color for UI display.
/// An email can carry multiple labels simultaneously.
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct MailLabel {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Mail account this label belongs to.
    pub account_id: Uuid,
    /// Label display name (e.g. "Work", "Important").
    pub name: String,
    /// CSS-compatible color string (e.g. `#e53935`, `hsl(210, 80%, 50%)`).
    pub color: Option<String>,
    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
}

/// Represents an automatic filtering rule applied to incoming emails.
///
/// Rules are evaluated in `priority` order. When a rule matches, its `actions`
/// are applied (move, label, mark as read, etc.). If `stop_processing` is set,
/// no further rules are evaluated for that email.
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct MailRule {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Mail account this rule belongs to.
    pub account_id: Uuid,
    /// Human-readable rule name.
    pub name: String,
    /// Evaluation order (lower = higher priority).
    pub priority: Option<i32>,
    /// Whether this rule is active.
    pub enabled: Option<bool>,
    /// JSON object describing match conditions (sender, subject, keywords, etc.).
    pub conditions: serde_json::Value,
    /// JSON object describing actions to perform (move, label, mark read, etc.).
    pub actions: serde_json::Value,
    /// If `true`, stop evaluating subsequent rules after this one matches.
    pub stop_processing: Option<bool>,
    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
    /// Row last-update timestamp.
    pub updated_at: Option<DateTime<Utc>>,
}
