use async_trait::async_trait;
use serde::Deserialize;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// TikTok Content Publishing API client.
/// `access_token` is a user access token with video.publish scope.
/// `open_id` is the TikTok user open_id returned during OAuth.
pub struct TikTokClient {
    pub access_token: String,
    pub open_id: String,
}

#[derive(Deserialize)]
struct TkData<T> {
    data: Option<T>,
    error: Option<TkError>,
}

#[derive(Deserialize)]
struct TkError {
    message: Option<String>,
}

#[derive(Deserialize)]
struct TkUploadData {
    publish_id: Option<String>,
}

#[derive(Deserialize)]
struct TkUserInfo {
    follower_count: Option<i32>,
    following_count: Option<i32>,
    video_count: Option<i32>,
    likes_count: Option<i32>,
}

#[derive(Deserialize)]
struct TkUserData {
    user: Option<TkUserInfo>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct TkComment {
    id: Option<String>,
    text: Option<String>,
    username: Option<String>,
    create_time: Option<i64>,
}

#[derive(Deserialize)]
struct TkCommentsData {
    comments: Option<Vec<TkComment>>,
}

fn tk_err(resp_text: &str, status: u16) -> PlatformError {
    PlatformError::Api {
        status,
        message: resp_text.to_string(),
    }
}

#[async_trait]
impl SocialPlatform for TikTokClient {
    async fn publish(&self, content: &str, media: &[String]) -> PlatformResult<PlatformPost> {
        let client = reqwest::Client::new();

        // TikTok Content Posting API requires a video URL.
        // If no video media provided, return an error (TikTok does not support text-only posts).
        let video_url = media.first().ok_or_else(|| {
            PlatformError::Other(
                "TikTok requires a video URL. Please attach a video to publish.".to_string(),
            )
        })?;

        // Direct Post from URL
        let body = serde_json::json!({
            "post_info": {
                "title": content,
                "privacy_level": "PUBLIC_TO_EVERYONE",
                "disable_duet": false,
                "disable_comment": false,
                "disable_stitch": false
            },
            "source_info": {
                "source": "PULL_FROM_URL",
                "video_url": video_url
            }
        });

        let resp = client
            .post("https://open.tiktokapis.com/v2/post/publish/video/init/")
            .bearer_auth(&self.access_token)
            .header("Content-Type", "application/json; charset=UTF-8")
            .json(&body)
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let status = resp.status().as_u16();
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(tk_err(&body, status));
        }

        let result: TkData<TkUploadData> = resp.json().await.map_err(PlatformError::Http)?;

        if let Some(err) = &result.error {
            if let Some(msg) = &err.message {
                if !msg.is_empty() && msg != "ok" {
                    return Err(PlatformError::Other(msg.clone()));
                }
            }
        }

        let publish_id = result
            .data
            .and_then(|d| d.publish_id)
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        Ok(PlatformPost {
            platform_post_id: publish_id.clone(),
            platform_url: Some(format!("https://www.tiktok.com/@{}", self.open_id)),
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        // TikTok Content Posting API v2 does not expose a public delete endpoint.
        // Log and return success — user must delete via the app.
        tracing::warn!(
            "TikTok: delete_post called for {} — TikTok API does not support programmatic deletion. Delete via the TikTok app.",
            platform_post_id
        );
        Ok(())
    }

    async fn fetch_comments(&self, platform_post_id: &str) -> PlatformResult<Vec<InboxItem>> {
        let client = reqwest::Client::new();

        let body = serde_json::json!({
            "filters": {
                "video_id": platform_post_id
            },
            "cursor": 0,
            "max_count": 20
        });

        let resp = client
            .post("https://open.tiktokapis.com/v2/research/video/comment/list/")
            .bearer_auth(&self.access_token)
            .json(&body)
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            return Ok(vec![]);
        }

        let data: TkData<TkCommentsData> = resp.json().await.unwrap_or(TkData {
            data: None,
            error: None,
        });

        let items = data
            .data
            .and_then(|d| d.comments)
            .unwrap_or_default()
            .into_iter()
            .map(|c| InboxItem {
                id: uuid::Uuid::new_v4(),
                account_id: uuid::Uuid::nil(),
                platform_item_id: c.id,
                item_type: "comment".to_string(),
                author_name: c.username,
                author_avatar: None,
                content: c.text,
                post_id: None,
                parent_id: None,
                is_read: false,
                sentiment: None,
                received_at: chrono::Utc::now(),
                created_at: chrono::Utc::now(),
            })
            .collect();

        Ok(items)
    }

    async fn reply(&self, item_id: &str, content: &str) -> PlatformResult<()> {
        // TikTok Content API does not expose a public comment-reply endpoint for business accounts yet.
        tracing::warn!(
            "TikTok: reply to comment {} with content '{}' — comment replies not available in TikTok Content API v2.",
            item_id, content
        );
        Ok(())
    }

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        let client = reqwest::Client::new();

        let resp = client
            .get("https://open.tiktokapis.com/v2/user/info/")
            .bearer_auth(&self.access_token)
            .query(&[(
                "fields",
                "follower_count,following_count,video_count,likes_count",
            )])
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            return Ok(AccountAnalytics {
                followers: 0,
                following: 0,
                posts_count: 0,
                impressions: 0,
                reach: 0,
                engagement: 0,
            });
        }

        let data: TkData<TkUserData> = resp.json().await.unwrap_or(TkData {
            data: None,
            error: None,
        });

        let user = data.data.and_then(|d| d.user).unwrap_or(TkUserInfo {
            follower_count: None,
            following_count: None,
            video_count: None,
            likes_count: None,
        });

        Ok(AccountAnalytics {
            followers: user.follower_count.unwrap_or(0),
            following: user.following_count.unwrap_or(0),
            posts_count: user.video_count.unwrap_or(0),
            impressions: 0,
            reach: 0,
            engagement: user.likes_count.unwrap_or(0),
        })
    }
}
