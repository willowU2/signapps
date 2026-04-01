use async_trait::async_trait;
use serde::Deserialize;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Google My Business (Business Profile) client.
/// `access_token` is the OAuth2 bearer token.
/// `account_id` and `location_id` are stored in platform_config.
pub struct GoogleBusinessClient {
    pub access_token: String,
    pub account_id: String,
    pub location_id: String,
}

#[derive(Deserialize)]
struct LocalPostResponse {
    name: String,
    #[serde(rename = "searchUrl")]
    search_url: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct MetricsResponse {
    #[serde(rename = "metricValues")]
    metric_values: Option<Vec<MetricValue>>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct MetricValue {
    metric: Option<String>,
    #[serde(rename = "totalValue")]
    total_value: Option<MetricDimension>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct MetricDimension {
    value: Option<String>,
}

impl GoogleBusinessClient {
    fn location_path(&self) -> String {
        format!(
            "accounts/{}/locations/{}",
            self.account_id, self.location_id
        )
    }
}

#[async_trait]
impl SocialPlatform for GoogleBusinessClient {
    async fn publish(&self, content: &str, _media: &[String]) -> PlatformResult<PlatformPost> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://mybusiness.googleapis.com/v4/{}/localPosts",
            self.location_path()
        );

        let resp = client
            .post(&url)
            .bearer_auth(&self.access_token)
            .json(&serde_json::json!({
                "languageCode": "en-US",
                "summary": content,
                "topicType": "STANDARD",
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

        let post: LocalPostResponse = resp.json().await.map_err(PlatformError::Http)?;
        // name looks like "accounts/123/locations/456/localPosts/789"
        let post_id = post.name.rsplit('/').next().unwrap_or("").to_string();

        Ok(PlatformPost {
            platform_post_id: post_id,
            platform_url: post.search_url,
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://mybusiness.googleapis.com/v4/{}/localPosts/{}",
            self.location_path(),
            platform_post_id
        );

        let resp = client
            .delete(&url)
            .bearer_auth(&self.access_token)
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

    async fn fetch_comments(&self, _platform_post_id: &str) -> PlatformResult<Vec<InboxItem>> {
        // Google Business local posts do not support threaded comments via API
        Ok(vec![])
    }

    async fn reply(&self, _item_id: &str, _content: &str) -> PlatformResult<()> {
        // Not supported for local posts
        Ok(())
    }

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://mybusiness.googleapis.com/v4/{}/localPosts",
            self.location_path()
        );

        // Fetch a list of posts to get count
        let resp = client
            .get(&url)
            .bearer_auth(&self.access_token)
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

        let data: serde_json::Value = resp.json().await.unwrap_or_default();
        let posts_count = data["localPosts"]
            .as_array()
            .map(|a| a.len() as i32)
            .unwrap_or(0);

        Ok(AccountAnalytics {
            followers: 0,
            following: 0,
            posts_count,
            impressions: 0,
            reach: 0,
            engagement: 0,
        })
    }
}
