use async_trait::async_trait;
use serde::Deserialize;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Facebook Graph API client.
/// The `page_id` is the Facebook Page ID; `access_token` is a page access token.
pub struct FacebookClient {
    pub access_token: String,
    pub page_id: String,
}

#[derive(Deserialize)]
struct FbPostResponse {
    id: String,
}

#[derive(Deserialize)]
struct FbComment {
    id: String,
    message: Option<String>,
    from: Option<FbUser>,
    created_time: Option<String>,
}

#[derive(Deserialize)]
struct FbUser {
    id: Option<String>,
    name: Option<String>,
    picture: Option<FbPicture>,
}

#[derive(Deserialize)]
struct FbPicture {
    data: Option<FbPictureData>,
}

#[derive(Deserialize)]
struct FbPictureData {
    url: Option<String>,
}

#[derive(Deserialize)]
struct FbCommentsResponse {
    data: Option<Vec<FbComment>>,
}

#[derive(Deserialize)]
struct FbInsight {
    name: String,
    values: Option<Vec<FbInsightValue>>,
}

#[derive(Deserialize)]
struct FbInsightValue {
    value: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct FbInsightsResponse {
    data: Option<Vec<FbInsight>>,
}

#[async_trait]
impl SocialPlatform for FacebookClient {
    async fn publish(&self, content: &str, media: &[String]) -> PlatformResult<PlatformPost> {
        let client = reqwest::Client::new();

        // Build form params
        let mut params = vec![
            ("message".to_string(), content.to_string()),
            ("access_token".to_string(), self.access_token.clone()),
        ];

        if let Some(url) = media.first() {
            // For a single image URL — use photos endpoint
            let photo_resp = client
                .post(format!(
                    "https://graph.facebook.com/v18.0/{}/photos",
                    self.page_id
                ))
                .form(&[
                    ("url", url.as_str()),
                    ("caption", content),
                    ("access_token", &self.access_token),
                    ("published", "true"),
                ])
                .send()
                .await
                .map_err(PlatformError::Http)?;

            let status = photo_resp.status().as_u16();
            if !photo_resp.status().is_success() {
                let body = photo_resp.text().await.unwrap_or_default();
                return Err(PlatformError::Api {
                    status,
                    message: body,
                });
            }

            let resp: FbPostResponse = photo_resp.json().await.map_err(PlatformError::Http)?;
            return Ok(PlatformPost {
                platform_post_id: resp.id.clone(),
                platform_url: Some(format!("https://www.facebook.com/{}", resp.id)),
            });
        }

        // Text post
        let resp = client
            .post(format!(
                "https://graph.facebook.com/v18.0/{}/feed",
                self.page_id
            ))
            .form(&params)
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

        let data: FbPostResponse = resp.json().await.map_err(PlatformError::Http)?;

        Ok(PlatformPost {
            platform_post_id: data.id.clone(),
            platform_url: Some(format!("https://www.facebook.com/{}", data.id)),
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
                ("fields", "id,message,from{id,name,picture},created_time"),
                ("access_token", &self.access_token),
            ])
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            return Ok(vec![]);
        }

        let data: FbCommentsResponse = resp
            .json()
            .await
            .unwrap_or(FbCommentsResponse { data: None });

        let items: Vec<InboxItem> = data
            .data
            .unwrap_or_default()
            .into_iter()
            .map(|c| {
                let author_name = c.from.as_ref().and_then(|f| f.name.clone());
                let author_avatar = c
                    .from
                    .as_ref()
                    .and_then(|f| f.picture.as_ref())
                    .and_then(|p| p.data.as_ref())
                    .and_then(|d| d.url.clone());

                InboxItem {
                    id: uuid::Uuid::new_v4(),
                    account_id: uuid::Uuid::nil(),
                    platform_item_id: Some(c.id),
                    item_type: "comment".to_string(),
                    author_name,
                    author_avatar,
                    content: c.message,
                    post_id: None,
                    parent_id: None,
                    is_read: false,
                    sentiment: None,
                    received_at: chrono::Utc::now(),
                    created_at: chrono::Utc::now(),
                }
            })
            .collect();

        Ok(items)
    }

    async fn reply(&self, item_id: &str, content: &str) -> PlatformResult<()> {
        let client = reqwest::Client::new();
        let resp = client
            .post(format!(
                "https://graph.facebook.com/v18.0/{}/comments",
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
        let resp = client
            .get(format!(
                "https://graph.facebook.com/v18.0/{}/insights",
                self.page_id
            ))
            .query(&[
                ("metric", "page_fans,page_impressions,page_engaged_users"),
                ("period", "day"),
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

        let data: FbInsightsResponse = resp
            .json()
            .await
            .unwrap_or(FbInsightsResponse { data: None });

        let mut followers = 0i32;
        let mut impressions = 0i32;
        let mut engagement = 0i32;

        for insight in data.data.unwrap_or_default() {
            let val = insight
                .values
                .as_ref()
                .and_then(|v| v.last())
                .and_then(|v| v.value.as_ref())
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32;

            match insight.name.as_str() {
                "page_fans" => followers = val,
                "page_impressions" => impressions = val,
                "page_engaged_users" => engagement = val,
                _ => {},
            }
        }

        Ok(AccountAnalytics {
            followers,
            following: 0,
            posts_count: 0,
            impressions,
            reach: impressions,
            engagement,
        })
    }
}
