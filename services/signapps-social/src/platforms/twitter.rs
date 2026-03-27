use async_trait::async_trait;
use serde::Deserialize;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Twitter/X API v2 client.
pub struct TwitterClient {
    pub access_token: String,
}

#[derive(Deserialize)]
struct TweetData {
    id: String,
}

#[derive(Deserialize)]
struct CreateTweetResponse {
    data: TweetData,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct TweetComment {
    id: String,
    text: Option<String>,
    author_id: Option<String>,
    created_at: Option<String>,
}

#[derive(Deserialize)]
struct SearchResponse {
    data: Option<Vec<TweetComment>>,
}

#[async_trait]
impl SocialPlatform for TwitterClient {
    async fn publish(&self, content: &str, _media: &[String]) -> PlatformResult<PlatformPost> {
        let client = reqwest::Client::new();
        let resp = client
            .post("https://api.twitter.com/2/tweets")
            .bearer_auth(&self.access_token)
            .json(&serde_json::json!({ "text": content }))
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let status = resp.status().as_u16();
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api {
                status,
                message: body,
            });
        }

        let data: CreateTweetResponse = resp.json().await.map_err(PlatformError::Http)?;

        Ok(PlatformPost {
            platform_post_id: data.data.id.clone(),
            platform_url: Some(format!("https://twitter.com/i/web/status/{}", data.data.id)),
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        let client = reqwest::Client::new();
        let resp = client
            .delete(format!(
                "https://api.twitter.com/2/tweets/{}",
                platform_post_id
            ))
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api {
                status,
                message: body,
            });
        }
        Ok(())
    }

    async fn fetch_comments(&self, platform_post_id: &str) -> PlatformResult<Vec<InboxItem>> {
        let client = reqwest::Client::new();
        // Search for replies to the tweet using conversation_id
        let url = format!(
            "https://api.twitter.com/2/tweets/search/recent?query=conversation_id:{}&tweet.fields=author_id,created_at&max_results=100",
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

        let data: SearchResponse = resp.json().await.unwrap_or(SearchResponse { data: None });

        let items: Vec<InboxItem> = data
            .data
            .unwrap_or_default()
            .into_iter()
            .map(|c| InboxItem {
                id: uuid::Uuid::new_v4(),
                account_id: uuid::Uuid::nil(),
                platform_item_id: Some(c.id),
                item_type: "reply".to_string(),
                author_name: c.author_id,
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
        let client = reqwest::Client::new();
        let resp = client
            .post("https://api.twitter.com/2/tweets")
            .bearer_auth(&self.access_token)
            .json(&serde_json::json!({
                "text": content,
                "reply": { "in_reply_to_tweet_id": item_id }
            }))
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api {
                status,
                message: body,
            });
        }
        Ok(())
    }

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        // Twitter API v2 analytics requires elevated access; return zeroed struct for now
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
