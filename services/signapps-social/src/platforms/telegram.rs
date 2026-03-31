use async_trait::async_trait;
use serde::Deserialize;
use uuid::Uuid;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Telegram Bot API client.
/// `bot_token` is from TELEGRAM_BOT_TOKEN env var or stored in access_token.
/// `chat_id` is stored in platform_config.
pub struct TelegramClient {
    pub bot_token: String,
    pub chat_id: String,
}

#[derive(Deserialize)]
struct TelegramResult {
    ok: bool,
    result: Option<TelegramMessage>,
    description: Option<String>,
}

#[derive(Deserialize)]
struct TelegramMessage {
    message_id: i64,
    chat: TelegramChat,
}

#[derive(Deserialize)]
struct TelegramChat {
    id: i64,
}

impl TelegramClient {
    fn api_url(&self, method: &str) -> String {
        format!("https://api.telegram.org/bot{}/{}", self.bot_token, method)
    }
}

#[async_trait]
impl SocialPlatform for TelegramClient {
    async fn publish(&self, content: &str, _media: &[String]) -> PlatformResult<PlatformPost> {
        let client = reqwest::Client::new();
        let resp = client
            .post(self.api_url("sendMessage"))
            .json(&serde_json::json!({
                "chat_id": self.chat_id,
                "text": content,
                "parse_mode": "HTML",
            }))
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let status = resp.status().as_u16();
        let body: TelegramResult = resp.json().await.map_err(PlatformError::Http)?;

        if !body.ok {
            return Err(PlatformError::Api {
                status,
                message: body
                    .description
                    .unwrap_or_else(|| "Telegram API error".to_string()),
            });
        }

        let msg = body
            .result
            .ok_or_else(|| PlatformError::Other("Telegram: no result in response".to_string()))?;

        let post_id = format!("{}:{}", msg.chat.id, msg.message_id);

        Ok(PlatformPost {
            platform_post_id: post_id,
            platform_url: None,
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        // platform_post_id format: "{chat_id}:{message_id}"
        let (chat_id, message_id) = platform_post_id
            .split_once(':')
            .ok_or_else(|| PlatformError::Other("Invalid Telegram post ID format".to_string()))?;

        let client = reqwest::Client::new();
        let resp = client
            .post(self.api_url("deleteMessage"))
            .json(&serde_json::json!({
                "chat_id": chat_id,
                "message_id": message_id.parse::<i64>().unwrap_or(0),
            }))
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let body: TelegramResult = resp.json().await.map_err(PlatformError::Http)?;

        if !body.ok {
            return Err(PlatformError::Other(
                body.description
                    .unwrap_or_else(|| "Telegram delete failed".to_string()),
            ));
        }
        Ok(())
    }

    async fn fetch_comments(&self, _platform_post_id: &str) -> PlatformResult<Vec<InboxItem>> {
        // Telegram does not expose post-level comment metrics via Bot API
        Ok(vec![])
    }

    async fn reply(&self, _item_id: &str, content: &str) -> PlatformResult<()> {
        // Reply to a message by sending to the same chat
        let client = reqwest::Client::new();
        let resp = client
            .post(self.api_url("sendMessage"))
            .json(&serde_json::json!({
                "chat_id": self.chat_id,
                "text": content,
            }))
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let body: TelegramResult = resp.json().await.map_err(PlatformError::Http)?;
        if !body.ok {
            return Err(PlatformError::Other(
                body.description
                    .unwrap_or_else(|| "Telegram reply failed".to_string()),
            ));
        }
        Ok(())
    }

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        // Telegram Bot API does not expose analytics
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
