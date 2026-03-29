use async_trait::async_trait;
use serde::Deserialize;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Pinterest API v5 client.
/// `access_token` is an OAuth2 token with boards:read, pins:read, pins:write scopes.
/// `board_id` is the target board ID where pins will be created.
pub struct PinterestClient {
    pub access_token: String,
    pub board_id: String,
}

#[derive(Deserialize)]
struct PinResponse {
    id: Option<String>,
    link: Option<String>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct PinComment {
    id: Option<String>,
    text: Option<String>,
    user: Option<PinUser>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct PinUser {
    username: Option<String>,
    profile_image: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct PinCommentsResponse {
    items: Option<Vec<PinComment>>,
}

#[derive(Deserialize)]
struct PinterestUserSummary {
    follower_count: Option<i32>,
    following_count: Option<i32>,
    pin_count: Option<i32>,
}

#[derive(Deserialize)]
struct PinterestAnalytics {
    daily_metrics: Option<Vec<PinterestDailyMetric>>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct PinterestDailyMetric {
    data_status: Option<String>,
    date: Option<String>,
    metrics: Option<PinterestMetrics>,
}

#[derive(Deserialize)]
struct PinterestMetrics {
    #[serde(rename = "IMPRESSION")]
    impression: Option<i32>,
    #[serde(rename = "TOTAL_AUDIENCE")]
    total_audience: Option<i32>,
    #[serde(rename = "ENGAGEMENT")]
    engagement: Option<i32>,
}

#[async_trait]
impl SocialPlatform for PinterestClient {
    async fn publish(&self, content: &str, media: &[String]) -> PlatformResult<PlatformPost> {
        let client = reqwest::Client::new();

        let mut pin_data = serde_json::json!({
            "board_id": self.board_id,
            "description": content,
            "title": if content.len() > 100 { &content[..100] } else { content },
        });

        if let Some(image_url) = media.first() {
            pin_data["media_source"] = serde_json::json!({
                "source_type": "image_url",
                "url": image_url
            });
        } else {
            // Pinterest requires media — cannot create a text-only pin
            return Err(PlatformError::Other(
                "Pinterest requires an image URL. Please attach an image to publish.".to_string(),
            ));
        }

        let resp = client
            .post("https://api.pinterest.com/v5/pins")
            .bearer_auth(&self.access_token)
            .json(&pin_data)
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

        let pin: PinResponse = resp.json().await.map_err(PlatformError::Http)?;
        let pin_id = pin.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        Ok(PlatformPost {
            platform_post_id: pin_id.clone(),
            platform_url: pin
                .link
                .or_else(|| Some(format!("https://www.pinterest.com/pin/{}/", pin_id))),
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        let client = reqwest::Client::new();
        let resp = client
            .delete(format!(
                "https://api.pinterest.com/v5/pins/{}",
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
        // Pinterest v5 API provides pin analytics but not public comment endpoints.
        // Comments/replies endpoint is not available in the current v5 public API.
        tracing::info!(
            "Pinterest: fetch_comments called for pin {} — Pinterest API v5 does not expose a public comments endpoint.",
            platform_post_id
        );
        Ok(vec![])
    }

    async fn reply(&self, item_id: &str, content: &str) -> PlatformResult<()> {
        // Pinterest does not expose a comment reply endpoint in v5 API.
        tracing::warn!(
            "Pinterest: reply to {} with '{}' — not supported in Pinterest API v5.",
            item_id,
            content
        );
        Ok(())
    }

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        let client = reqwest::Client::new();

        // Fetch user profile
        let user_resp = client
            .get("https://api.pinterest.com/v5/user_account")
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let (followers, following, posts_count) = if user_resp.status().is_success() {
            let user: PinterestUserSummary =
                user_resp.json().await.unwrap_or(PinterestUserSummary {
                    follower_count: None,
                    following_count: None,
                    pin_count: None,
                });
            (
                user.follower_count.unwrap_or(0),
                user.following_count.unwrap_or(0),
                user.pin_count.unwrap_or(0),
            )
        } else {
            (0, 0, 0)
        };

        // Fetch account analytics
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let seven_days_ago = (chrono::Utc::now() - chrono::Duration::days(7))
            .format("%Y-%m-%d")
            .to_string();

        let analytics_resp = client
            .get("https://api.pinterest.com/v5/user_account/analytics")
            .bearer_auth(&self.access_token)
            .query(&[
                ("start_date", seven_days_ago.as_str()),
                ("end_date", today.as_str()),
                ("metric_types", "IMPRESSION,TOTAL_AUDIENCE,ENGAGEMENT"),
            ])
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let mut impressions = 0i32;
        let mut reach = 0i32;
        let mut engagement = 0i32;

        if analytics_resp.status().is_success() {
            let data: PinterestAnalytics =
                analytics_resp.json().await.unwrap_or(PinterestAnalytics {
                    daily_metrics: None,
                });

            // Average over the last day with data
            if let Some(metric) = data
                .daily_metrics
                .and_then(|m| {
                    m.into_iter()
                        .rev()
                        .find(|d| d.data_status.as_deref() != Some("PROCESSING"))
                })
                .and_then(|d| d.metrics)
            {
                impressions = metric.impression.unwrap_or(0);
                reach = metric.total_audience.unwrap_or(0);
                engagement = metric.engagement.unwrap_or(0);
            }
        }

        Ok(AccountAnalytics {
            followers,
            following,
            posts_count,
            impressions,
            reach,
            engagement,
        })
    }
}
