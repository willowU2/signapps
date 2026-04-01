use async_trait::async_trait;
use serde::Deserialize;
use uuid::Uuid;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Dev.to API client (API key auth).
pub struct DevToClient {
    pub api_key: String,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct ArticleResponse {
    id: u64,
    url: Option<String>,
    page_views_count: Option<i32>,
    public_reactions_count: Option<i32>,
    comments_count: Option<i32>,
}

#[derive(Deserialize)]
struct CommentResponse {
    id_code: String,
    user: Option<CommentUser>,
    body_html: Option<String>,
}

#[derive(Deserialize)]
struct CommentUser {
    name: Option<String>,
    profile_image: Option<String>,
}

#[async_trait]
impl SocialPlatform for DevToClient {
    async fn publish(&self, content: &str, _media: &[String]) -> PlatformResult<PlatformPost> {
        // First line = title, rest = markdown body
        let (title, body) = if let Some(nl) = content.find('\n') {
            (&content[..nl], &content[nl + 1..])
        } else {
            (content, "")
        };

        let client = reqwest::Client::new();
        let resp = client
            .post("https://dev.to/api/articles")
            .header("api-key", &self.api_key)
            .json(&serde_json::json!({
                "article": {
                    "title": title,
                    "body_markdown": body,
                    "published": true,
                }
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

        let article: ArticleResponse = resp.json().await.map_err(PlatformError::Http)?;

        Ok(PlatformPost {
            platform_post_id: article.id.to_string(),
            platform_url: article.url,
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        let client = reqwest::Client::new();
        let url = format!("https://dev.to/api/articles/{}", platform_post_id);

        let resp = client
            .delete(&url)
            .header("api-key", &self.api_key)
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
        let url = format!("https://dev.to/api/comments?a_id={}", platform_post_id);

        let resp = client
            .get(&url)
            .header("api-key", &self.api_key)
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            return Ok(vec![]);
        }

        let comments: Vec<CommentResponse> = resp.json().await.unwrap_or_default();
        let items = comments
            .into_iter()
            .map(|c| InboxItem {
                id: Uuid::new_v4(),
                account_id: Uuid::nil(),
                platform_item_id: Some(c.id_code),
                item_type: "comment".to_string(),
                author_name: c.user.as_ref().and_then(|u| u.name.clone()),
                author_avatar: c.user.as_ref().and_then(|u| u.profile_image.clone()),
                content: c.body_html,
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

    async fn reply(&self, _item_id: &str, _content: &str) -> PlatformResult<()> {
        // Dev.to API does not support posting replies programmatically
        Err(PlatformError::Other(
            "Dev.to does not support replies via API".to_string(),
        ))
    }

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        let client = reqwest::Client::new();
        // Fetch the user's articles to sum metrics
        let resp = client
            .get("https://dev.to/api/articles/me")
            .header("api-key", &self.api_key)
            .query(&[("per_page", "1000")])
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

        let articles: Vec<ArticleResponse> = resp.json().await.unwrap_or_default();
        let posts_count = articles.len() as i32;
        let impressions: i32 = articles
            .iter()
            .map(|a| a.page_views_count.unwrap_or(0))
            .sum();
        let engagement: i32 = articles
            .iter()
            .map(|a| a.public_reactions_count.unwrap_or(0))
            .sum();

        Ok(AccountAnalytics {
            followers: 0,
            following: 0,
            posts_count,
            impressions,
            reach: impressions,
            engagement,
        })
    }
}
