use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SocialAccount {
    pub id: Uuid,
    pub user_id: Uuid,
    pub platform: String,
    pub platform_user_id: Option<String>,
    pub username: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    #[serde(skip_serializing)]
    pub access_token: Option<String>,
    #[serde(skip_serializing)]
    pub refresh_token: Option<String>,
    pub token_expires_at: Option<DateTime<Utc>>,
    pub platform_config: JsonValue,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAccountRequest {
    pub platform: String,
    pub platform_user_id: Option<String>,
    pub username: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub token_expires_at: Option<DateTime<Utc>>,
    pub platform_config: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAccountRequest {
    pub username: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub is_active: Option<bool>,
    pub platform_config: Option<JsonValue>,
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Post {
    pub id: Uuid,
    pub user_id: Uuid,
    pub status: String,
    pub content: String,
    pub media_urls: JsonValue,
    pub hashtags: JsonValue,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub published_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub is_evergreen: bool,
    pub template_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePostRequest {
    pub content: String,
    pub media_urls: Option<JsonValue>,
    pub hashtags: Option<JsonValue>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub is_evergreen: Option<bool>,
    pub template_id: Option<Uuid>,
    pub account_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePostRequest {
    pub content: Option<String>,
    pub media_urls: Option<JsonValue>,
    pub hashtags: Option<JsonValue>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub is_evergreen: Option<bool>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SchedulePostRequest {
    pub scheduled_at: DateTime<Utc>,
    pub account_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PostTarget {
    pub id: Uuid,
    pub post_id: Uuid,
    pub account_id: Uuid,
    pub platform_post_id: Option<String>,
    pub platform_url: Option<String>,
    pub content_override: Option<String>,
    pub status: String,
    pub error_message: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct InboxItem {
    pub id: Uuid,
    pub account_id: Uuid,
    pub platform_item_id: Option<String>,
    pub item_type: String,
    pub author_name: Option<String>,
    pub author_avatar: Option<String>,
    pub content: Option<String>,
    pub post_id: Option<Uuid>,
    pub parent_id: Option<Uuid>,
    pub is_read: bool,
    pub sentiment: Option<String>,
    pub received_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ReplyRequest {
    pub content: String,
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AccountAnalyticsRow {
    pub id: Uuid,
    pub account_id: Uuid,
    pub date: NaiveDate,
    pub followers: Option<i32>,
    pub following: Option<i32>,
    pub posts_count: Option<i32>,
    pub impressions: Option<i32>,
    pub reach: Option<i32>,
    pub engagement: Option<i32>,
    pub clicks: Option<i32>,
    pub shares: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PostAnalyticsRow {
    pub id: Uuid,
    pub post_target_id: Uuid,
    pub impressions: Option<i32>,
    pub reach: Option<i32>,
    pub likes: Option<i32>,
    pub comments: Option<i32>,
    pub shares: Option<i32>,
    pub clicks: Option<i32>,
    pub saves: Option<i32>,
    pub updated_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// RSS Feeds
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RssFeed {
    pub id: Uuid,
    pub user_id: Uuid,
    pub feed_url: String,
    pub name: Option<String>,
    pub target_accounts: JsonValue,
    pub post_template: Option<String>,
    pub is_active: bool,
    pub last_checked_at: Option<DateTime<Utc>>,
    pub last_item_guid: Option<String>,
    pub check_interval_minutes: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRssFeedRequest {
    pub feed_url: String,
    pub name: Option<String>,
    pub target_accounts: Option<JsonValue>,
    pub post_template: Option<String>,
    pub check_interval_minutes: Option<i32>,
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PostTemplate {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub content: String,
    pub hashtags: JsonValue,
    pub category: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub content: String,
    pub hashtags: Option<JsonValue>,
    pub category: Option<String>,
}

// ---------------------------------------------------------------------------
// AI requests
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct AiGenerateRequest {
    pub topic: String,
    pub tone: Option<String>,
    pub platform: Option<String>,
    pub max_length: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct AiHashtagsRequest {
    pub content: String,
    pub platform: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AiBestTimeRequest {
    pub account_id: Uuid,
    pub platform: Option<String>,
}

// ---------------------------------------------------------------------------
// Platform types (used by platform clients)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformPost {
    pub platform_post_id: String,
    pub platform_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountAnalytics {
    pub followers: i32,
    pub following: i32,
    pub posts_count: i32,
    pub impressions: i32,
    pub reach: i32,
    pub engagement: i32,
}
