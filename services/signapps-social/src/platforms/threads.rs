use async_trait::async_trait;
use serde::Deserialize;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Threads API client (Meta's text platform).
/// Uses the Threads API (graph.threads.net) — same OAuth as Instagram.
/// `access_token` is a long-lived Threads user token.
/// `user_id` is the Threads user ID.
pub struct ThreadsClient {
    pub access_token: String,
    pub user_id: String,
}

#[derive(Deserialize)]
struct ThMediaResponse {
    id: String,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct ThReply {
    id: String,
    text: Option<String>,
    username: Option<String>,
    timestamp: Option<String>,
}

#[derive(Deserialize)]
struct ThRepliesResponse {
    data: Option<Vec<ThReply>>,
}

#[derive(Deserialize)]
struct ThUserInfo {
    followers_count: Option<i32>,
    threads_count: Option<i32>,
}

#[async_trait]
impl SocialPlatform for ThreadsClient {
    async fn publish(&self, content: &str, media: &[String]) -> PlatformResult<PlatformPost> {
        let client = reqwest::Client::new();

        // Step 1: Create media container
        let mut params = vec![
            ("text", content.to_string()),
            ("access_token", self.access_token.clone()),
        ];

        if let Some(image_url) = media.first() {
            params.push(("media_type", "IMAGE".to_string()));
            params.push(("image_url", image_url.clone()));
        } else {
            params.push(("media_type", "TEXT".to_string()));
        }

        let container_resp = client
            .post(format!(
                "https://graph.threads.net/v1.0/{}/threads",
                self.user_id
            ))
            .form(&params)
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let status = container_resp.status().as_u16();
        if !container_resp.status().is_success() {
            let body = container_resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api { status, message: body });
        }

        let container: ThMediaResponse = container_resp.json().await.map_err(PlatformError::Http)?;

        // Step 2: Publish the container
        let publish_resp = client
            .post(format!(
                "https://graph.threads.net/v1.0/{}/threads_publish",
                self.user_id
            ))
            .form(&[
                ("creation_id", container.id.as_str()),
                ("access_token", self.access_token.as_str()),
            ])
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let status = publish_resp.status().as_u16();
        if !publish_resp.status().is_success() {
            let body = publish_resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api { status, message: body });
        }

        let published: ThMediaResponse = publish_resp.json().await.map_err(PlatformError::Http)?;

        Ok(PlatformPost {
            platform_post_id: published.id.clone(),
            platform_url: Some(format!(
                "https://www.threads.net/@{}/post/{}",
                self.user_id, published.id
            )),
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        let client = reqwest::Client::new();
        let resp = client
            .delete(format!(
                "https://graph.threads.net/v1.0/{}",
                platform_post_id
            ))
            .query(&[("access_token", &self.access_token)])
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api { status, message: body });
        }
        Ok(())
    }

    async fn fetch_comments(&self, platform_post_id: &str) -> PlatformResult<Vec<InboxItem>> {
        let client = reqwest::Client::new();
        let resp = client
            .get(format!(
                "https://graph.threads.net/v1.0/{}/replies",
                platform_post_id
            ))
            .query(&[
                ("fields", "id,text,username,timestamp"),
                ("access_token", &self.access_token),
            ])
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            return Ok(vec![]);
        }

        let data: ThRepliesResponse = resp
            .json()
            .await
            .unwrap_or(ThRepliesResponse { data: None });

        let items = data
            .data
            .unwrap_or_default()
            .into_iter()
            .map(|r| InboxItem {
                id: uuid::Uuid::new_v4(),
                account_id: uuid::Uuid::nil(),
                platform_item_id: Some(r.id),
                item_type: "reply".to_string(),
                author_name: r.username,
                author_avatar: None,
                content: r.text,
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

        // Step 1: Create a reply container targeting the parent thread
        let container_resp = client
            .post(format!(
                "https://graph.threads.net/v1.0/{}/threads",
                self.user_id
            ))
            .form(&[
                ("media_type", "TEXT"),
                ("text", content),
                ("reply_to_id", item_id),
                ("access_token", &self.access_token),
            ])
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let status = container_resp.status().as_u16();
        if !container_resp.status().is_success() {
            let body = container_resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api { status, message: body });
        }

        let container: ThMediaResponse = container_resp.json().await.map_err(PlatformError::Http)?;

        // Step 2: Publish the reply
        let publish_resp = client
            .post(format!(
                "https://graph.threads.net/v1.0/{}/threads_publish",
                self.user_id
            ))
            .form(&[
                ("creation_id", container.id.as_str()),
                ("access_token", self.access_token.as_str()),
            ])
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !publish_resp.status().is_success() {
            let status = publish_resp.status().as_u16();
            let body = publish_resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api { status, message: body });
        }
        Ok(())
    }

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        let client = reqwest::Client::new();

        let resp = client
            .get(format!(
                "https://graph.threads.net/v1.0/{}",
                self.user_id
            ))
            .query(&[
                ("fields", "followers_count,threads_count"),
                ("access_token", &self.access_token),
            ])
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

        let user: ThUserInfo = resp.json().await.unwrap_or(ThUserInfo {
            followers_count: None,
            threads_count: None,
        });

        Ok(AccountAnalytics {
            followers: user.followers_count.unwrap_or(0),
            following: 0,
            posts_count: user.threads_count.unwrap_or(0),
            impressions: 0,
            reach: 0,
            engagement: 0,
        })
    }
}
