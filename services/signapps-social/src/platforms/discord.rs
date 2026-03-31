use async_trait::async_trait;
use serde::Deserialize;
use uuid::Uuid;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Discord Webhook client.
/// `webhook_url` is the full Discord webhook URL.
pub struct DiscordClient {
    pub webhook_url: String,
}

#[derive(Deserialize)]
struct WebhookMessageResponse {
    id: String,
}

#[async_trait]
impl SocialPlatform for DiscordClient {
    async fn publish(&self, content: &str, _media: &[String]) -> PlatformResult<PlatformPost> {
        let client = reqwest::Client::new();
        // Use ?wait=true so Discord returns the message object with an ID
        let url = format!("{}?wait=true", self.webhook_url.trim_end_matches('/'));

        let resp = client
            .post(&url)
            .json(&serde_json::json!({
                "content": content,
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

        let msg: WebhookMessageResponse = resp.json().await.map_err(PlatformError::Http)?;

        Ok(PlatformPost {
            platform_post_id: msg.id.clone(),
            platform_url: None,
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        let client = reqwest::Client::new();
        let url = format!(
            "{}/messages/{}",
            self.webhook_url.trim_end_matches('/'),
            platform_post_id
        );

        let resp = client
            .delete(&url)
            .send()
            .await
            .map_err(PlatformError::Http)?;

        // 204 No Content is the success response for Discord delete
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

    async fn fetch_comments(&self, _platform_post_id: &str) -> PlatformResult<Vec<InboxItem>> {
        // Discord webhooks cannot receive or fetch replies
        Ok(vec![])
    }

    async fn reply(&self, _item_id: &str, content: &str) -> PlatformResult<()> {
        // Post another message to the webhook channel as a follow-up
        let client = reqwest::Client::new();
        let resp = client
            .post(self.webhook_url.trim_end_matches('/'))
            .json(&serde_json::json!({ "content": content }))
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
        // Discord webhooks have no analytics API
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
