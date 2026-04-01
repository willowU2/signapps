use async_trait::async_trait;
use serde::Deserialize;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Medium Integration Token client.
/// `integration_token` is the user-issued token stored as access_token.
/// `user_id` is fetched once and cached (stored in platform_config).
pub struct MediumClient {
    pub integration_token: String,
    pub user_id: String,
}

#[derive(Deserialize)]
struct MediumPostResponse {
    data: MediumPostData,
}

#[derive(Deserialize)]
struct MediumPostData {
    id: String,
    url: Option<String>,
}

#[async_trait]
impl SocialPlatform for MediumClient {
    async fn publish(&self, content: &str, _media: &[String]) -> PlatformResult<PlatformPost> {
        // First line = title, rest = body (HTML or Markdown)
        let (title, body) = if let Some(nl) = content.find('\n') {
            (&content[..nl], &content[nl + 1..])
        } else {
            (content, "")
        };

        let client = reqwest::Client::new();
        let url = format!("https://api.medium.com/v1/users/{}/posts", self.user_id);

        let resp = client
            .post(&url)
            .bearer_auth(&self.integration_token)
            .json(&serde_json::json!({
                "title": title,
                "contentFormat": "markdown",
                "content": body,
                "publishStatus": "public",
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

        let result: MediumPostResponse = resp.json().await.map_err(PlatformError::Http)?;

        Ok(PlatformPost {
            platform_post_id: result.data.id,
            platform_url: result.data.url,
        })
    }

    async fn delete_post(&self, _platform_post_id: &str) -> PlatformResult<()> {
        // Medium API does not support post deletion
        Err(PlatformError::Other(
            "Medium does not support post deletion via API".to_string(),
        ))
    }

    async fn fetch_comments(&self, _platform_post_id: &str) -> PlatformResult<Vec<InboxItem>> {
        // Medium API does not expose comments
        Ok(vec![])
    }

    async fn reply(&self, _item_id: &str, _content: &str) -> PlatformResult<()> {
        // Medium API does not support replies
        Err(PlatformError::Other(
            "Medium does not support replies via API".to_string(),
        ))
    }

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        // Medium API does not expose analytics
        Ok(AccountAnalytics {
            followers: 0,
            following: 0,
            posts_count: 0,
            impressions: 0,
            reach: 0,
            engagement: 0,
        })
    }
}
