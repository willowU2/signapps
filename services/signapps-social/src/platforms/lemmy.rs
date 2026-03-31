use async_trait::async_trait;
use serde::Deserialize;
use uuid::Uuid;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Lemmy API v3 client (JWT auth).
/// `instance_url` is the Lemmy instance base URL.
/// `jwt` is the authentication token (from login, stored as access_token).
/// `community_id` is the target community (stored in platform_config).
pub struct LemmyClient {
    pub instance_url: String,
    pub jwt: String,
    pub community_id: i64,
}

#[derive(Deserialize)]
struct LemmyPostResponse {
    post_view: LemmyPostView,
}

#[derive(Deserialize)]
struct LemmyPostView {
    post: LemmyPost,
    counts: Option<LemmyCounts>,
}

#[derive(Deserialize)]
struct LemmyPost {
    id: i64,
    ap_id: Option<String>,
}

#[derive(Deserialize)]
struct LemmyCounts {
    upvotes: Option<i32>,
    downvotes: Option<i32>,
    comments: Option<i32>,
}

#[derive(Deserialize)]
struct LemmyCommentView {
    comment: LemmyComment,
    creator: Option<LemmyCreator>,
}

#[derive(Deserialize)]
struct LemmyComment {
    id: i64,
    content: String,
}

#[derive(Deserialize)]
struct LemmyCreator {
    name: Option<String>,
    avatar: Option<String>,
}

impl LemmyClient {
    fn api_url(&self, path: &str) -> String {
        format!(
            "{}/api/v3/{}",
            self.instance_url.trim_end_matches('/'),
            path
        )
    }
}

#[async_trait]
impl SocialPlatform for LemmyClient {
    async fn publish(&self, content: &str, _media: &[String]) -> PlatformResult<PlatformPost> {
        // First line = title (required by Lemmy), rest = body (optional)
        let (title, body) = if let Some(nl) = content.find('\n') {
            (&content[..nl], Some(&content[nl + 1..]))
        } else {
            (content, None)
        };

        let client = reqwest::Client::new();
        let mut payload = serde_json::json!({
            "community_id": self.community_id,
            "name": title,
            "auth": self.jwt,
        });

        if let Some(b) = body {
            if !b.is_empty() {
                payload["body"] = serde_json::Value::String(b.to_string());
            }
        }

        let resp = client
            .post(self.api_url("post"))
            .json(&payload)
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

        let result: LemmyPostResponse = resp.json().await.map_err(PlatformError::Http)?;
        let post_id = result.post_view.post.id.to_string();
        let ap_id = result.post_view.post.ap_id;

        Ok(PlatformPost {
            platform_post_id: post_id,
            platform_url: ap_id,
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        let post_id = platform_post_id
            .parse::<i64>()
            .map_err(|_| PlatformError::Other("Invalid Lemmy post ID".to_string()))?;

        let client = reqwest::Client::new();
        let resp = client
            .post(self.api_url("post/delete"))
            .json(&serde_json::json!({
                "post_id": post_id,
                "deleted": true,
                "auth": self.jwt,
            }))
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

    async fn fetch_comments(&self, platform_post_id: &str) -> PlatformResult<Vec<InboxItem>> {
        let client = reqwest::Client::new();
        let resp = client
            .get(self.api_url("comment/list"))
            .query(&[
                ("post_id", platform_post_id),
                ("limit", "100"),
                ("auth", &self.jwt),
            ])
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            return Ok(vec![]);
        }

        let data: serde_json::Value = resp.json().await.unwrap_or_default();
        let mut items = Vec::new();

        if let Some(comments) = data["comments"].as_array() {
            for cv in comments {
                let view: LemmyCommentView = match serde_json::from_value(cv.clone()) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                items.push(InboxItem {
                    id: Uuid::new_v4(),
                    account_id: Uuid::nil(),
                    platform_item_id: Some(view.comment.id.to_string()),
                    item_type: "comment".to_string(),
                    author_name: view.creator.as_ref().and_then(|c| c.name.clone()),
                    author_avatar: view.creator.as_ref().and_then(|c| c.avatar.clone()),
                    content: Some(view.comment.content),
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
        // item_id = parent comment ID
        let parent_id = item_id
            .parse::<i64>()
            .map_err(|_| PlatformError::Other("Invalid Lemmy comment ID".to_string()))?;

        let client = reqwest::Client::new();
        let resp = client
            .post(self.api_url("comment"))
            .json(&serde_json::json!({
                "content": content,
                "parent_id": parent_id,
                "auth": self.jwt,
            }))
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
        // Fetch community details for subscriber count
        let resp = client
            .get(self.api_url("community"))
            .query(&[("id", &self.community_id.to_string()), ("auth", &self.jwt)])
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

        let data: serde_json::Value = resp.json().await.unwrap_or_default();
        let subscribers = data["community_view"]["counts"]["subscribers"]
            .as_i64()
            .unwrap_or(0) as i32;
        let posts = data["community_view"]["counts"]["posts"]
            .as_i64()
            .unwrap_or(0) as i32;

        Ok(AccountAnalytics {
            followers: subscribers,
            following: 0,
            posts_count: posts,
            impressions: 0,
            reach: 0,
            engagement: 0,
        })
    }
}
