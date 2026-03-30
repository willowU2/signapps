use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct MailAccount {
    pub id: Uuid,
    pub user_id: Uuid,
    pub email_address: String,
    pub display_name: Option<String>,
    pub provider: String,

    // IMAP
    pub imap_server: Option<String>,
    pub imap_port: Option<i32>,
    pub imap_use_tls: Option<bool>,

    // SMTP
    pub smtp_server: Option<String>,
    pub smtp_port: Option<i32>,
    pub smtp_use_tls: Option<bool>,

    // Auth
    #[serde(skip_serializing)]
    pub app_password: Option<String>,
    #[serde(skip_serializing)]
    pub oauth_token: Option<String>,
    #[serde(skip_serializing)]
    pub oauth_refresh_token: Option<String>,
    pub oauth_expires_at: Option<DateTime<Utc>>,

    // Sync
    pub status: Option<String>,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub sync_interval_minutes: Option<i32>,

    // Signature
    pub signature_html: Option<String>,
    pub signature_text: Option<String>,

    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct MailFolder {
    pub id: Uuid,
    pub account_id: Uuid,
    pub name: String,
    pub folder_type: String,
    pub imap_path: Option<String>,
    pub unread_count: Option<i32>,
    pub total_count: Option<i32>,
    pub parent_id: Option<Uuid>,
    /// Highest IMAP UID successfully synced for incremental sync (Idea 50)
    pub last_synced_uid: Option<i64>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Email {
    pub id: Uuid,
    pub account_id: Uuid,
    pub folder_id: Option<Uuid>,

    pub message_id: Option<String>,
    pub in_reply_to: Option<String>,
    pub thread_id: Option<Uuid>,
    pub imap_uid: Option<i64>,

    pub sender: String,
    pub sender_name: Option<String>,
    pub recipient: String,
    pub cc: Option<String>,
    pub bcc: Option<String>,
    pub reply_to: Option<String>,
    pub subject: Option<String>,

    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub snippet: Option<String>,

    pub is_read: Option<bool>,
    pub is_starred: Option<bool>,
    pub is_important: Option<bool>,
    pub is_draft: Option<bool>,
    pub is_sent: Option<bool>,
    pub is_archived: Option<bool>,
    pub is_deleted: Option<bool>,

    pub labels: Option<Vec<String>>,
    pub snoozed_until: Option<DateTime<Utc>>,
    pub scheduled_send_at: Option<DateTime<Utc>>,

    pub received_at: Option<DateTime<Utc>>,
    pub sent_at: Option<DateTime<Utc>>,
    pub size_bytes: Option<i32>,
    pub has_attachments: Option<bool>,

    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Attachment {
    pub id: Uuid,
    pub email_id: Uuid,
    pub filename: String,
    pub mime_type: Option<String>,
    pub size_bytes: Option<i64>,
    pub content_id: Option<String>,
    pub is_inline: Option<bool>,
    pub storage_bucket: Option<String>,
    pub storage_key: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct MailLabel {
    pub id: Uuid,
    pub account_id: Uuid,
    pub name: String,
    pub color: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct MailRule {
    pub id: Uuid,
    pub account_id: Uuid,
    pub name: String,
    pub priority: Option<i32>,
    pub enabled: Option<bool>,
    pub conditions: serde_json::Value,
    pub actions: serde_json::Value,
    pub stop_processing: Option<bool>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}
