use async_trait::async_trait;
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mastodon_client_creation_stores_credentials() {
        let client = MastodonClient::new("https://mastodon.social", "token_abc123");
        assert_eq!(client.instance_url, "https://mastodon.social");
        assert_eq!(client.access_token, "token_abc123");
    }

    #[test]
    fn test_mastodon_api_url_construction() {
        let client = MastodonClient::new("https://mastodon.social", "token");
        let url = client.api("/statuses");
        assert_eq!(url, "https://mastodon.social/api/v1/statuses");
    }

    #[test]
    fn test_mastodon_api_url_strips_trailing_slash() {
        let client = MastodonClient::new("https://mastodon.social/", "token");
        let url = client.api("/statuses");
        assert_eq!(
            url, "https://mastodon.social/api/v1/statuses",
            "Trailing slash should be stripped from instance URL"
        );
    }

    #[test]
    fn test_mastodon_bearer_format() {
        let client = MastodonClient::new("https://mastodon.social", "my_access_token");
        assert_eq!(client.bearer(), "Bearer my_access_token");
    }
}

/// Mastodon API client using reqwest.
pub struct MastodonClient {
    pub instance_url: String,
    pub access_token: String,
    http: reqwest::Client,
}

impl MastodonClient {
    pub fn new(instance_url: impl Into<String>, access_token: impl Into<String>) -> Self {
        Self {
            instance_url: instance_url.into(),
            access_token: access_token.into(),
            http: reqwest::Client::new(),
        }
    }

    fn api(&self, path: &str) -> String {
        format!("{}/api/v1{}", self.instance_url.trim_end_matches('/'), path)
    }

    fn bearer(&self) -> String {
        format!("Bearer {}", self.access_token)
    }
}

// ---------- serde helpers --------------------------------------------------

#[derive(Debug, Deserialize)]
struct MastodonStatus {
    id: String,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MastodonContext {
    descendants: Vec<MastodonStatusFull>,
}

#[derive(Debug, Deserialize)]
struct MastodonStatusFull {
    id: String,
    account: MastodonAccount,
    content: Option<String>,
    #[allow(dead_code)]
    created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MastodonAccount {
    display_name: Option<String>,
    avatar: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MastodonCredentials {
    followers_count: Option<i32>,
    following_count: Option<i32>,
    statuses_count: Option<i32>,
}

// ---------- trait impl -----------------------------------------------------

#[async_trait]
impl SocialPlatform for MastodonClient {
    async fn publish(&self, content: &str, _media: &[String]) -> PlatformResult<PlatformPost> {
        let resp = self
            .http
            .post(self.api("/statuses"))
            .header("Authorization", self.bearer())
            .json(&serde_json::json!({ "status": content }))
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let message = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api { status, message });
        }

        let status: MastodonStatus = resp.json().await?;
        Ok(PlatformPost {
            platform_post_id: status.id,
            platform_url: status.url,
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        let resp = self
            .http
            .delete(self.api(&format!("/statuses/{}", platform_post_id)))
            .header("Authorization", self.bearer())
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let message = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api { status, message });
        }
        Ok(())
    }

    async fn fetch_comments(&self, platform_post_id: &str) -> PlatformResult<Vec<InboxItem>> {
        let resp = self
            .http
            .get(self.api(&format!("/statuses/{}/context", platform_post_id)))
            .header("Authorization", self.bearer())
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let message = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api { status, message });
        }

        let ctx: MastodonContext = resp.json().await?;
        let items = ctx
            .descendants
            .into_iter()
            .map(|s| InboxItem {
                id: Uuid::new_v4(),
                account_id: Uuid::nil(),
                platform_item_id: Some(s.id),
                item_type: "comment".to_string(),
                author_name: s.account.display_name,
                author_avatar: s.account.avatar,
                content: s.content,
                post_id: None,
                parent_id: None,
                is_read: false,
                sentiment: None,
                received_at: Utc::now(),
                created_at: Utc::now(),
            })
            .collect();

        Ok(items)
    }

    async fn reply(&self, _item_id: &str, content: &str) -> PlatformResult<()> {
        let resp = self
            .http
            .post(self.api("/statuses"))
            .header("Authorization", self.bearer())
            .json(&serde_json::json!({
                "status": content,
                "in_reply_to_id": _item_id,
            }))
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let message = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api { status, message });
        }
        Ok(())
    }

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        let resp = self
            .http
            .get(self.api("/accounts/verify_credentials"))
            .header("Authorization", self.bearer())
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let message = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api { status, message });
        }

        let creds: MastodonCredentials = resp.json().await?;
        Ok(AccountAnalytics {
            followers: creds.followers_count.unwrap_or(0),
            following: creds.following_count.unwrap_or(0),
            posts_count: creds.statuses_count.unwrap_or(0),
            impressions: 0,
            reach: 0,
            engagement: 0,
        })
    }
}
