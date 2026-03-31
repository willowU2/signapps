use async_trait::async_trait;
use serde::Deserialize;
use uuid::Uuid;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// WordPress REST API client (Application Password).
/// `site_url` is the WordPress site base URL (e.g. "https://myblog.com").
/// `username` and `app_password` are used with HTTP Basic Auth.
pub struct WordPressClient {
    pub site_url: String,
    pub username: String,
    pub app_password: String,
}

#[derive(Deserialize)]
struct WpPost {
    id: u64,
    link: Option<String>,
}

#[derive(Deserialize)]
struct WpComment {
    id: u64,
    author_name: Option<String>,
    author_avatar_urls: Option<std::collections::HashMap<String, String>>,
    content: Option<WpRendered>,
}

#[derive(Deserialize)]
struct WpRendered {
    rendered: Option<String>,
}

impl WordPressClient {
    fn api_url(&self, path: &str) -> String {
        format!(
            "{}/wp-json/wp/v2/{}",
            self.site_url.trim_end_matches('/'),
            path
        )
    }

    fn basic_auth_header(&self) -> String {
        use base64::{engine::general_purpose, Engine as _};
        let credentials = format!("{}:{}", self.username, self.app_password);
        format!(
            "Basic {}",
            general_purpose::STANDARD.encode(credentials.as_bytes())
        )
    }
}

#[async_trait]
impl SocialPlatform for WordPressClient {
    async fn publish(&self, content: &str, _media: &[String]) -> PlatformResult<PlatformPost> {
        // First line = title, rest = content (HTML supported)
        let (title, body) = if let Some(nl) = content.find('\n') {
            (&content[..nl], &content[nl + 1..])
        } else {
            (content, "")
        };

        let client = reqwest::Client::new();
        let resp = client
            .post(self.api_url("posts"))
            .header("Authorization", self.basic_auth_header())
            .json(&serde_json::json!({
                "title": title,
                "content": body,
                "status": "publish",
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

        let post: WpPost = resp.json().await.map_err(PlatformError::Http)?;

        Ok(PlatformPost {
            platform_post_id: post.id.to_string(),
            platform_url: post.link,
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        let client = reqwest::Client::new();
        let url = self.api_url(&format!("posts/{}", platform_post_id));

        let resp = client
            .delete(&url)
            .header("Authorization", self.basic_auth_header())
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
        let url = self.api_url("comments");

        let resp = client
            .get(&url)
            .header("Authorization", self.basic_auth_header())
            .query(&[("post", platform_post_id), ("per_page", "100")])
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            return Ok(vec![]);
        }

        let comments: Vec<WpComment> = resp.json().await.unwrap_or_default();
        let items = comments
            .into_iter()
            .map(|c| {
                let avatar = c
                    .author_avatar_urls
                    .as_ref()
                    .and_then(|m| m.get("96").cloned());
                InboxItem {
                    id: Uuid::new_v4(),
                    account_id: Uuid::nil(),
                    platform_item_id: Some(c.id.to_string()),
                    item_type: "comment".to_string(),
                    author_name: c.author_name,
                    author_avatar: avatar,
                    content: c.content.and_then(|r| r.rendered),
                    post_id: None,
                    parent_id: None,
                    is_read: false,
                    sentiment: None,
                    received_at: chrono::Utc::now(),
                    created_at: chrono::Utc::now(),
                }
            })
            .collect();

        Ok(items)
    }

    async fn reply(&self, item_id: &str, content: &str) -> PlatformResult<()> {
        // item_id = comment ID to reply to
        let client = reqwest::Client::new();
        let resp = client
            .post(self.api_url("comments"))
            .header("Authorization", self.basic_auth_header())
            .json(&serde_json::json!({
                "content": content,
                "parent": item_id.parse::<u64>().unwrap_or(0),
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
        // WordPress REST API does not expose page-view analytics without Jetpack
        let client = reqwest::Client::new();
        let resp = client
            .get(self.api_url("posts"))
            .header("Authorization", self.basic_auth_header())
            .query(&[("per_page", "1"), ("_fields", "id")])
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let posts_count = if resp.status().is_success() {
            resp.headers()
                .get("X-WP-Total")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<i32>().ok())
                .unwrap_or(0)
        } else {
            0
        };

        Ok(AccountAnalytics {
            followers: 0,
            following: 0,
            posts_count,
            impressions: 0,
            reach: 0,
            engagement: 0,
        })
    }
}
