use async_trait::async_trait;
use serde::Deserialize;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// LinkedIn API v2 client.
pub struct LinkedinClient {
    pub access_token: String,
    /// LinkedIn person/organization URN, e.g. "urn:li:person:ABC123"
    pub author_urn: String,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct LiPostResponse {
    id: Option<String>,
}

#[derive(Deserialize)]
struct LiSocialActionsResponse {
    elements: Option<Vec<LiComment>>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct LiComment {
    #[serde(rename = "$URN")]
    urn: Option<String>,
    message: Option<LiText>,
    actor: Option<String>,
    created: Option<LiTimestamp>,
}

#[derive(Deserialize)]
struct LiText {
    text: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct LiTimestamp {
    time: Option<i64>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct LiProfile {
    #[serde(rename = "localizedFirstName")]
    first_name: Option<String>,
    #[serde(rename = "localizedLastName")]
    last_name: Option<String>,
}

#[async_trait]
impl SocialPlatform for LinkedinClient {
    async fn publish(&self, content: &str, _media: &[String]) -> PlatformResult<PlatformPost> {
        let client = reqwest::Client::new();

        // Build a UGC (User Generated Content) post
        let body = serde_json::json!({
            "author": self.author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {
                        "text": content
                    },
                    "shareMediaCategory": "NONE"
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            }
        });

        let resp = client
            .post("https://api.linkedin.com/v2/ugcPosts")
            .bearer_auth(&self.access_token)
            .header("X-Restli-Protocol-Version", "2.0.0")
            .json(&body)
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let status = resp.status().as_u16();
        // LinkedIn returns 201 + X-RestLi-Id header for the created post URN
        let post_urn = resp
            .headers()
            .get("x-restli-id")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        if status != 201 && !resp.status().is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api {
                status,
                message: body_text,
            });
        }

        // Encode URN for use as URL path segment
        let encoded_urn = urlencoding::encode(&post_urn).to_string();

        Ok(PlatformPost {
            platform_post_id: post_urn.clone(),
            platform_url: Some(format!(
                "https://www.linkedin.com/feed/update/{}",
                encoded_urn
            )),
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        let client = reqwest::Client::new();
        let encoded = urlencoding::encode(platform_post_id).to_string();
        let resp = client
            .delete(format!("https://api.linkedin.com/v2/ugcPosts/{}", encoded))
            .bearer_auth(&self.access_token)
            .header("X-Restli-Protocol-Version", "2.0.0")
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
        let encoded = urlencoding::encode(platform_post_id).to_string();
        let resp = client
            .get(format!(
                "https://api.linkedin.com/v2/socialActions/{}/comments",
                encoded
            ))
            .bearer_auth(&self.access_token)
            .header("X-Restli-Protocol-Version", "2.0.0")
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            return Ok(vec![]);
        }

        let data: LiSocialActionsResponse = resp
            .json()
            .await
            .unwrap_or(LiSocialActionsResponse { elements: None });

        let items: Vec<InboxItem> = data
            .elements
            .unwrap_or_default()
            .into_iter()
            .map(|c| InboxItem {
                id: uuid::Uuid::new_v4(),
                account_id: uuid::Uuid::nil(),
                platform_item_id: c.urn.clone(),
                item_type: "comment".to_string(),
                author_name: c.actor,
                author_avatar: None,
                content: c.message.and_then(|m| m.text),
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
        // LinkedIn reply = posting a new comment on a social action
        let client = reqwest::Client::new();
        let encoded = urlencoding::encode(item_id).to_string();

        let body = serde_json::json!({
            "actor": self.author_urn,
            "message": { "text": content }
        });

        let resp = client
            .post(format!(
                "https://api.linkedin.com/v2/socialActions/{}/comments",
                encoded
            ))
            .bearer_auth(&self.access_token)
            .header("X-Restli-Protocol-Version", "2.0.0")
            .json(&body)
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body_text = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api {
                status,
                message: body_text,
            });
        }
        Ok(())
    }

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        // LinkedIn follower stats via Organization API (requires org URN)
        let client = reqwest::Client::new();
        let _encoded = urlencoding::encode(&self.author_urn).to_string();

        let resp = client
            .get("https://api.linkedin.com/v2/networkSizes/me")
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let followers = if resp.status().is_success() {
            #[derive(Deserialize)]
            struct NetworkSize {
                #[serde(rename = "firstDegreeSize")]
                size: Option<i32>,
            }
            resp.json::<NetworkSize>()
                .await
                .ok()
                .and_then(|n| n.size)
                .unwrap_or(0)
        } else {
            0
        };

        Ok(AccountAnalytics {
            followers,
            following: 0,
            posts_count: 0,
            impressions: 0,
            reach: 0,
            engagement: 0,
        })
    }
}
