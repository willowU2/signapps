use async_trait::async_trait;
use serde::Deserialize;
use uuid::Uuid;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Slack Web API client (OAuth2 bot token).
/// `access_token` is the Bot OAuth token (xoxb-...).
/// `channel` is the Slack channel ID stored in platform_config.
pub struct SlackClient {
    pub access_token: String,
    pub channel: String,
}

#[derive(Deserialize)]
struct SlackResponse {
    ok: bool,
    ts: Option<String>,
    channel: Option<String>,
    error: Option<String>,
}

#[async_trait]
impl SocialPlatform for SlackClient {
    async fn publish(&self, content: &str, _media: &[String]) -> PlatformResult<PlatformPost> {
        let client = reqwest::Client::new();
        let resp = client
            .post("https://slack.com/api/chat.postMessage")
            .bearer_auth(&self.access_token)
            .json(&serde_json::json!({
                "channel": self.channel,
                "text": content,
            }))
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let status = resp.status().as_u16();
        let body: SlackResponse = resp.json().await.map_err(PlatformError::Http)?;

        if !body.ok {
            return Err(PlatformError::Api {
                status,
                message: body.error.unwrap_or_else(|| "Slack API error".to_string()),
            });
        }

        // Slack message ID = channel+ts combo (ts is the unique timestamp)
        let ts = body
            .ts
            .ok_or_else(|| PlatformError::Other("Slack: missing ts".to_string()))?;
        let ch = body.channel.unwrap_or_else(|| self.channel.clone());
        let post_id = format!("{}:{}", ch, ts);

        Ok(PlatformPost {
            platform_post_id: post_id,
            platform_url: None,
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        // platform_post_id format: "{channel}:{ts}"
        let (channel, ts) = platform_post_id
            .split_once(':')
            .ok_or_else(|| PlatformError::Other("Invalid Slack post ID format".to_string()))?;

        let client = reqwest::Client::new();
        let resp = client
            .post("https://slack.com/api/chat.delete")
            .bearer_auth(&self.access_token)
            .json(&serde_json::json!({
                "channel": channel,
                "ts": ts,
            }))
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let body: SlackResponse = resp.json().await.map_err(PlatformError::Http)?;

        if !body.ok {
            return Err(PlatformError::Other(
                body.error
                    .unwrap_or_else(|| "Slack delete failed".to_string()),
            ));
        }
        Ok(())
    }

    async fn fetch_comments(&self, platform_post_id: &str) -> PlatformResult<Vec<InboxItem>> {
        // Fetch thread replies using conversations.replies
        let (channel, ts) = match platform_post_id.split_once(':') {
            Some(v) => v,
            None => return Ok(vec![]),
        };

        let client = reqwest::Client::new();
        let resp = client
            .get("https://slack.com/api/conversations.replies")
            .bearer_auth(&self.access_token)
            .query(&[("channel", channel), ("ts", ts), ("limit", "100")])
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            return Ok(vec![]);
        }

        let data: serde_json::Value = resp.json().await.unwrap_or_default();
        let mut items = Vec::new();

        if let Some(messages) = data["messages"].as_array() {
            // Skip the first element (it's the parent message itself)
            for msg in messages.iter().skip(1) {
                items.push(InboxItem {
                    id: Uuid::new_v4(),
                    account_id: Uuid::nil(),
                    platform_item_id: msg["ts"].as_str().map(str::to_string),
                    item_type: "reply".to_string(),
                    author_name: msg["user"].as_str().map(str::to_string),
                    author_avatar: None,
                    content: msg["text"].as_str().map(str::to_string),
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
        // Reply in-thread: item_id = "{channel}:{ts}"
        let (channel, thread_ts) = item_id
            .split_once(':')
            .ok_or_else(|| PlatformError::Other("Invalid Slack item ID format".to_string()))?;

        let client = reqwest::Client::new();
        let resp = client
            .post("https://slack.com/api/chat.postMessage")
            .bearer_auth(&self.access_token)
            .json(&serde_json::json!({
                "channel": channel,
                "text": content,
                "thread_ts": thread_ts,
            }))
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let body: SlackResponse = resp.json().await.map_err(PlatformError::Http)?;
        if !body.ok {
            return Err(PlatformError::Other(
                body.error
                    .unwrap_or_else(|| "Slack reply failed".to_string()),
            ));
        }
        Ok(())
    }

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        // Slack does not expose follower/analytics metrics via standard Bot API
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
