use async_trait::async_trait;
use serde::Deserialize;
use uuid::Uuid;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Dribbble API v2 client (OAuth2).
pub struct DribbbleClient {
    pub access_token: String,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct ShotResponse {
    id: u64,
    html_url: Option<String>,
    likes_count: Option<i32>,
    views_count: Option<i32>,
}

#[derive(Deserialize)]
struct UserResponse {
    followers_count: Option<i32>,
    following_count: Option<i32>,
    shots_count: Option<i32>,
}

#[async_trait]
impl SocialPlatform for DribbbleClient {
    async fn publish(&self, content: &str, media: &[String]) -> PlatformResult<PlatformPost> {
        let client = reqwest::Client::new();

        // Dribbble requires a multipart form upload for images.
        // We extract title/description from content (first line = title, rest = description).
        let (title, description) = if let Some(nl) = content.find('\n') {
            (&content[..nl], &content[nl + 1..])
        } else {
            (content, "")
        };

        let image_url = media.first().cloned().unwrap_or_default();

        let resp = client
            .post("https://api.dribbble.com/v2/shots")
            .bearer_auth(&self.access_token)
            .json(&serde_json::json!({
                "title": title,
                "description": description,
                "image": image_url,
                "published": true,
            }))
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let status = resp.status().as_u16();
        if !resp.status().is_success() {
            let msg = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api {
                status,
                message: msg,
            });
        }

        let shot: ShotResponse = resp.json().await.map_err(PlatformError::Http)?;

        Ok(PlatformPost {
            platform_post_id: shot.id.to_string(),
            platform_url: shot.html_url,
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        let client = reqwest::Client::new();
        let url = format!("https://api.dribbble.com/v2/shots/{}", platform_post_id);

        let resp = client
            .delete(&url)
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if resp.status().as_u16() != 204 && !resp.status().is_success() {
            let status = resp.status().as_u16();
            let msg = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api {
                status,
                message: msg,
            });
        }
        Ok(())
    }

    async fn fetch_comments(&self, platform_post_id: &str) -> PlatformResult<Vec<InboxItem>> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://api.dribbble.com/v2/shots/{}/comments",
            platform_post_id
        );

        let resp = client
            .get(&url)
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            return Ok(vec![]);
        }

        let data: serde_json::Value = resp.json().await.unwrap_or_default();
        let mut items = Vec::new();

        if let Some(comments) = data.as_array() {
            for c in comments {
                items.push(InboxItem {
                    id: Uuid::new_v4(),
                    account_id: Uuid::nil(),
                    platform_item_id: c["id"].as_u64().map(|id| id.to_string()),
                    item_type: "comment".to_string(),
                    author_name: c["player"]["name"].as_str().map(str::to_string),
                    author_avatar: c["player"]["avatar_url"].as_str().map(str::to_string),
                    content: c["body"].as_str().map(str::to_string),
                    post_id: None,
                    parent_id: None,
                    is_read: false,
                    sentiment: None,
                    received_at: chrono::Utc::now(),
                    created_at: chrono::Utc::now(),
                });
            }
        }

        Ok(items)
    }

    async fn reply(&self, item_id: &str, content: &str) -> PlatformResult<()> {
        // item_id format: "{shot_id}:{comment_id}" or just shot_id for a new comment
        let shot_id = item_id.split(':').next().unwrap_or(item_id);
        let client = reqwest::Client::new();
        let url = format!("https://api.dribbble.com/v2/shots/{}/comments", shot_id);

        let resp = client
            .post(&url)
            .bearer_auth(&self.access_token)
            .json(&serde_json::json!({ "body": content }))
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let msg = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api {
                status,
                message: msg,
            });
        }
        Ok(())
    }

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        let client = reqwest::Client::new();
        let resp = client
            .get("https://api.dribbble.com/v2/user")
            .bearer_auth(&self.access_token)
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

        let user: UserResponse = resp.json().await.unwrap_or(UserResponse {
            followers_count: None,
            following_count: None,
            shots_count: None,
        });

        Ok(AccountAnalytics {
            followers: user.followers_count.unwrap_or(0),
            following: user.following_count.unwrap_or(0),
            posts_count: user.shots_count.unwrap_or(0),
            impressions: 0,
            reach: 0,
            engagement: 0,
        })
    }
}
