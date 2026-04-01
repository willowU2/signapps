use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a social account.
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

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateAccount operation.
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

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for UpdateAccount operation.
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

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a post.
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

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreatePost operation.
pub struct CreatePostRequest {
    pub content: String,
    pub media_urls: Option<JsonValue>,
    pub hashtags: Option<JsonValue>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub is_evergreen: Option<bool>,
    pub template_id: Option<Uuid>,
    pub account_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for UpdatePost operation.
pub struct UpdatePostRequest {
    pub content: Option<String>,
    pub media_urls: Option<JsonValue>,
    pub hashtags: Option<JsonValue>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub is_evergreen: Option<bool>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for SchedulePost operation.
pub struct SchedulePostRequest {
    pub scheduled_at: DateTime<Utc>,
    pub account_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for ApproveReject operation.
pub struct ApproveRejectRequest {
    pub rejection_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
/// Represents a post target.
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

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a inbox item.
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

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for Reply operation.
pub struct ReplyRequest {
    pub content: String,
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
/// Represents a account analytics row.
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
/// Represents a post analytics row.
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

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a rss feed.
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

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateRssFeed operation.
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

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a post template.
pub struct PostTemplate {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub content: String,
    pub hashtags: JsonValue,
    pub category: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateTemplate operation.
pub struct CreateTemplateRequest {
    pub name: String,
    pub content: String,
    pub hashtags: Option<JsonValue>,
    pub category: Option<String>,
}

// ---------------------------------------------------------------------------
// AI requests
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for AiGenerate operation.
pub struct AiGenerateRequest {
    pub topic: String,
    pub tone: Option<String>,
    pub platform: Option<String>,
    pub max_length: Option<u32>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for AiHashtags operation.
pub struct AiHashtagsRequest {
    pub content: String,
    pub platform: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for AiBestTime operation.
pub struct AiBestTimeRequest {
    pub account_id: Uuid,
    pub platform: Option<String>,
}

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a signature.
pub struct Signature {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub content: String,
    pub is_auto_add: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateSignature operation.
pub struct CreateSignatureRequest {
    pub name: String,
    pub content: String,
    pub is_auto_add: Option<bool>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for UpdateSignature operation.
pub struct UpdateSignatureRequest {
    pub name: Option<String>,
    pub content: Option<String>,
    pub is_auto_add: Option<bool>,
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a media item.
pub struct MediaItem {
    pub id: Uuid,
    pub user_id: Uuid,
    pub filename: String,
    pub original_name: Option<String>,
    pub mime_type: String,
    pub size_bytes: i64,
    pub url: String,
    pub thumbnail_url: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub duration_seconds: Option<f32>,
    pub tags: JsonValue,
    pub usage_count: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateMedia operation.
pub struct CreateMediaRequest {
    pub filename: String,
    pub original_name: Option<String>,
    pub mime_type: String,
    pub size_bytes: Option<i64>,
    pub url: String,
    pub thumbnail_url: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub tags: Option<JsonValue>,
}

// ---------------------------------------------------------------------------
// Short URLs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a short url.
pub struct ShortUrl {
    pub id: Uuid,
    pub user_id: Uuid,
    pub short_code: String,
    pub original_url: String,
    pub post_id: Option<Uuid>,
    pub clicks: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateShortUrl operation.
pub struct CreateShortUrlRequest {
    pub original_url: String,
    pub post_id: Option<Uuid>,
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a webhook.
pub struct Webhook {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub url: String,
    pub events: JsonValue,
    pub account_filter: Option<Uuid>,
    pub secret: Option<String>,
    pub is_active: bool,
    pub last_triggered_at: Option<DateTime<Utc>>,
    pub last_status_code: Option<i32>,
    pub failure_count: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateWebhook operation.
pub struct CreateWebhookRequest {
    pub name: String,
    pub url: String,
    pub events: Option<JsonValue>,
    pub account_filter: Option<Uuid>,
    pub secret: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for UpdateWebhook operation.
pub struct UpdateWebhookRequest {
    pub name: Option<String>,
    pub url: Option<String>,
    pub events: Option<JsonValue>,
    pub account_filter: Option<Uuid>,
    pub is_active: Option<bool>,
}

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a workspace.
pub struct Workspace {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    pub slug: String,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateWorkspace operation.
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub slug: String,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a workspace member.
pub struct WorkspaceMember {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub invited_at: DateTime<Utc>,
    pub accepted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for InviteMember operation.
pub struct InviteMemberRequest {
    pub user_id: Uuid,
    pub role: Option<String>,
}

// ---------------------------------------------------------------------------
// Post comments (team review)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a post comment.
pub struct PostComment {
    pub id: Uuid,
    pub post_id: Uuid,
    pub user_id: Uuid,
    pub content: String,
    pub parent_comment_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreatePostComment operation.
pub struct CreatePostCommentRequest {
    pub content: String,
    pub parent_comment_id: Option<Uuid>,
}

// ---------------------------------------------------------------------------
// Time slots
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a time slot.
pub struct TimeSlot {
    pub id: Uuid,
    pub user_id: Uuid,
    pub account_id: Option<Uuid>,
    pub day_of_week: i32,
    pub hour: i32,
    pub minute: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateTimeSlot operation.
pub struct CreateTimeSlotRequest {
    pub account_id: Option<Uuid>,
    pub day_of_week: i32,
    pub hour: i32,
    pub minute: Option<i32>,
}

// ---------------------------------------------------------------------------
// Content sets
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a content set.
pub struct ContentSet {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub content: String,
    pub media_urls: JsonValue,
    pub hashtags: JsonValue,
    pub target_accounts: JsonValue,
    pub platform_overrides: JsonValue,
    pub signature_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateContentSet operation.
pub struct CreateContentSetRequest {
    pub name: String,
    pub description: Option<String>,
    pub content: String,
    pub media_urls: Option<JsonValue>,
    pub hashtags: Option<JsonValue>,
    pub target_accounts: Option<JsonValue>,
    pub platform_overrides: Option<JsonValue>,
    pub signature_id: Option<Uuid>,
}

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a api key.
pub struct ApiKey {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    #[serde(skip_serializing)]
    pub key_hash: String,
    pub key_prefix: String,
    pub scopes: JsonValue,
    pub rate_limit_per_hour: i32,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateApiKey operation.
pub struct CreateApiKeyRequest {
    pub name: String,
    pub scopes: Option<JsonValue>,
    pub rate_limit_per_hour: Option<i32>,
    pub expires_at: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
// Platform types (used by platform clients)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents a platform post.
pub struct PlatformPost {
    pub platform_post_id: String,
    pub platform_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents a account analytics.
pub struct AccountAnalytics {
    pub followers: i32,
    pub following: i32,
    pub posts_count: i32,
    pub impressions: i32,
    pub reach: i32,
    pub engagement: i32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_platform_post_serialization() {
        let post = PlatformPost {
            platform_post_id: "post_123".to_string(),
            platform_url: Some("https://mastodon.social/@user/123".to_string()),
        };
        let json = serde_json::to_string(&post).expect("Serialization failed");
        assert!(json.contains("post_123"));
        assert!(json.contains("mastodon.social"));
    }

    #[test]
    fn test_platform_post_deserialization() {
        let json = r#"{"platform_post_id":"xyz","platform_url":"https://example.com/post/xyz"}"#;
        let post: PlatformPost = serde_json::from_str(json).expect("Deserialization failed");
        assert_eq!(post.platform_post_id, "xyz");
        assert_eq!(
            post.platform_url.as_deref(),
            Some("https://example.com/post/xyz")
        );
    }

    #[test]
    fn test_platform_post_roundtrip() {
        let original = PlatformPost {
            platform_post_id: "abc456".to_string(),
            platform_url: None,
        };
        let json = serde_json::to_string(&original).expect("PlatformPost must serialize");
        let decoded: PlatformPost =
            serde_json::from_str(&json).expect("PlatformPost must deserialize from its own JSON");
        assert_eq!(decoded.platform_post_id, original.platform_post_id);
        assert_eq!(decoded.platform_url, original.platform_url);
    }

    #[test]
    fn test_account_analytics_serialization() {
        let analytics = AccountAnalytics {
            followers: 1000,
            following: 200,
            posts_count: 50,
            impressions: 5000,
            reach: 3000,
            engagement: 150,
        };
        let json = serde_json::to_string(&analytics).expect("Serialization failed");
        assert!(json.contains("1000"));
        assert!(json.contains("followers"));
    }

    #[test]
    fn test_account_analytics_roundtrip() {
        let original = AccountAnalytics {
            followers: 42,
            following: 10,
            posts_count: 7,
            impressions: 100,
            reach: 80,
            engagement: 5,
        };
        let json = serde_json::to_string(&original).expect("AccountAnalytics must serialize");
        let decoded: AccountAnalytics = serde_json::from_str(&json)
            .expect("AccountAnalytics must deserialize from its own JSON");
        assert_eq!(decoded.followers, 42);
        assert_eq!(decoded.following, 10);
        assert_eq!(decoded.posts_count, 7);
    }

    #[test]
    fn test_post_serialization_roundtrip() {
        let now = chrono::Utc::now();
        let post = Post {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            status: "draft".to_string(),
            content: "Hello world #test".to_string(),
            media_urls: serde_json::json!([]),
            hashtags: serde_json::json!(["test"]),
            scheduled_at: Some(now),
            published_at: None,
            error_message: None,
            is_evergreen: false,
            template_id: None,
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&post).expect("Post must serialize");
        let decoded: Post =
            serde_json::from_str(&json).expect("Post must deserialize from its own JSON");
        assert_eq!(decoded.content, "Hello world #test");
        assert_eq!(decoded.status, "draft");
    }

    #[test]
    fn test_inbox_item_serialization() {
        let now = chrono::Utc::now();
        let item = InboxItem {
            id: Uuid::new_v4(),
            account_id: Uuid::new_v4(),
            platform_item_id: Some("item_001".to_string()),
            item_type: "comment".to_string(),
            author_name: Some("Alice".to_string()),
            author_avatar: None,
            content: Some("Great post!".to_string()),
            post_id: None,
            parent_id: None,
            is_read: false,
            sentiment: Some("positive".to_string()),
            received_at: now,
            created_at: now,
        };
        let json = serde_json::to_string(&item).expect("InboxItem must serialize");
        assert!(json.contains("comment"));
        assert!(json.contains("Alice"));
    }
}
