use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct MailAccount {
    pub id: Uuid,
    pub user_id: Uuid,
    pub email_address: String,
    pub provider: String,
    pub imap_server: Option<String>,
    pub imap_port: Option<i32>,
    pub smtp_server: Option<String>,
    pub smtp_port: Option<i32>,
    pub app_password: Option<String>,
    pub oauth_token: Option<String>,
    pub oauth_refresh_token: Option<String>,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub status: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Email {
    pub id: Uuid,
    pub account_id: Option<Uuid>,
    pub sender: String,
    pub recipient: String,
    pub subject: String,
    pub body: String,
    pub is_read: Option<bool>,
    pub is_archived: Option<bool>,
    pub is_deleted: Option<bool>,
    pub labels: Option<Vec<String>>,
    pub snoozed_until: Option<DateTime<Utc>>,
    pub folder: Option<String>,
    pub message_id: Option<String>,
    pub thread_id: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}
