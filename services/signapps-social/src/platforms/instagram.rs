use async_trait::async_trait;
use serde::Deserialize;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Instagram Graph API client.
/// `user_id` is the Instagram Business/Creator account ID.
/// `access_token` is a long-lived page access token with instagram_basic, instagram_content_publish scopes.
pub struct InstagramClient {
    pub access_token: String,
    pub user_id: String,
}

#[derive(Deserialize)]
struct IgMediaResponse {
    id: String,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct IgComment {
    id: String,
    text: Option<String>,
    username: Option<String>,
    timestamp: Option<String>,
}

#[derive(Deserialize)]
struct IgCommentsResponse {
    data: Option<Vec<IgComment>>,
}

#[derive(Deserialize)]
struct IgInsight {
    name: String,
    values: Option<Vec<IgInsightValue>>,
}

#[derive(Deserialize)]
struct IgInsightValue {
    value: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct IgInsightsResponse {
    data: Option<Vec<IgInsight>>,
}

#[derive(Deserialize)]
struct IgUserInfo {
    followers_count: Option<i32>,
    follows_count: Option<i32>,
    media_count: Option<i32>,
}

#[async_trait]
impl SocialPlatform for InstagramClient {
    async fn publish(&self, content: &str, media: &[String]) -> PlatformResult<PlatformPost> {
        let client = reqwest::Client::new();

        // Step 1: Create media container
        let mut params = vec![
            ("caption", content.to_string()),
            ("access_token", self.access_token.clone()),
        ];

        if let Some(image_url) = media.first() {
            params.push(("image_url", image_url.clone()));
        } else {
            // Text-only: use image_url with a transparent pixel or carousel workaround
            // Instagram requires media — use a carousel text post via image placeholder
            params.push(("media_type", "IMAGE".to_string()));
        }

        let container_resp = client
            .post(format!(
                "https://graph.facebook.com/v18.0/{}/media",
                self.user_id
            ))
            .form(&params)
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let status = container_resp.status().as_u16();
        if !container_resp.status().is_success() {
            let body = container_resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api {
                status,
                message: body,
            });
        }

        let container: IgMediaResponse =
            container_resp.json().await.map_err(PlatformError::Http)?;

        // Step 2: Publish the container
        let publish_resp = client
            .post(format!(
                "https://graph.facebook.com/v18.0/{}/media_publish",
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
            return Err(PlatformError::Api {
                status,
                message: body,
            });
        }

        let published: IgMediaResponse = publish_resp.json().await.map_err(PlatformError::Http)?;

        Ok(PlatformPost {
            platform_post_id: published.id.clone(),
            platform_url: Some(format!("https://www.instagram.com/p/{}/", published.id)),
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        let client = reqwest::Client::new();
        let resp = client
            .delete(format!(
                "https://graph.facebook.com/v18.0/{}",
                platform_post_id
            ))
            .query(&[("access_token", &self.access_token)])
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
        let resp = client
            .get(format!(
                "https://graph.facebook.com/v18.0/{}/comments",
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

        let data: IgCommentsResponse = resp
            .json()
            .await
            .unwrap_or(IgCommentsResponse { data: None });

        let items = data
            .data
            .unwrap_or_default()
            .into_iter()
            .map(|c| InboxItem {
                id: uuid::Uuid::new_v4(),
                account_id: uuid::Uuid::nil(),
                platform_item_id: Some(c.id),
                item_type: "comment".to_string(),
                author_name: c.username,
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
            .post(format!(
                "https://graph.facebook.com/v18.0/{}/replies",
                item_id
            ))
            .form(&[("message", content), ("access_token", &self.access_token)])
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
        let client = reqwest::Client::new();

        // Fetch user profile for follower counts
        let user_resp = client
            .get(format!("https://graph.facebook.com/v18.0/{}", self.user_id))
            .query(&[
                ("fields", "followers_count,follows_count,media_count"),
                ("access_token", &self.access_token),
            ])
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !user_resp.status().is_success() {
            return Ok(AccountAnalytics {
                followers: 0,
                following: 0,
                posts_count: 0,
                impressions: 0,
                reach: 0,
                engagement: 0,
            });
        }

        let user: IgUserInfo = user_resp.json().await.unwrap_or(IgUserInfo {
            followers_count: None,
            follows_count: None,
            media_count: None,
        });

        // Fetch insights for impressions/reach
        let insights_resp = client
            .get(format!(
                "https://graph.facebook.com/v18.0/{}/insights",
                self.user_id
            ))
            .query(&[
                ("metric", "impressions,reach,profile_views"),
                ("period", "day"),
                ("access_token", &self.access_token),
            ])
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let mut impressions = 0i32;
        let mut reach = 0i32;

        if insights_resp.status().is_success() {
            let data: IgInsightsResponse = insights_resp
                .json()
                .await
                .unwrap_or(IgInsightsResponse { data: None });

            for insight in data.data.unwrap_or_default() {
                let val = insight
                    .values
                    .as_ref()
                    .and_then(|v| v.last())
                    .and_then(|v| v.value.as_ref())
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0) as i32;

                match insight.name.as_str() {
                    "impressions" => impressions = val,
                    "reach" => reach = val,
                    _ => {},
                }
            }
        }

        Ok(AccountAnalytics {
            followers: user.followers_count.unwrap_or(0),
            following: user.follows_count.unwrap_or(0),
            posts_count: user.media_count.unwrap_or(0),
            impressions,
            reach,
            engagement: 0,
        })
    }
}
