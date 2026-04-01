use async_trait::async_trait;
use serde::Deserialize;
use uuid::Uuid;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Reddit OAuth2 client (script/web app using bearer token).
pub struct RedditClient {
    pub access_token: String,
    pub username: String,
}

#[derive(Deserialize)]
struct SubmitResponse {
    json: SubmitJson,
}

#[derive(Deserialize)]
struct SubmitJson {
    data: Option<SubmitData>,
    errors: Option<Vec<serde_json::Value>>,
}

#[derive(Deserialize)]
struct SubmitData {
    id: Option<String>,
    url: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct InfoResponse {
    data: Option<InfoData>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct InfoData {
    children: Option<Vec<InfoChild>>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct InfoChild {
    data: Option<InfoPost>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct InfoPost {
    ups: Option<i32>,
    num_comments: Option<i32>,
}

#[async_trait]
impl SocialPlatform for RedditClient {
    async fn publish(&self, content: &str, _media: &[String]) -> PlatformResult<PlatformPost> {
        let client = reqwest::Client::new();
        // Default subreddit: user profile (u/username). The caller can put "r/subreddit title\nbody" in content.
        // Convention: first line = title, rest = body; subreddit pulled from platform_config by caller.
        let (title, body) = if let Some(nl) = content.find('\n') {
            (&content[..nl], &content[nl + 1..])
        } else {
            (content, "")
        };

        let resp = client
            .post("https://oauth.reddit.com/api/submit")
            .bearer_auth(&self.access_token)
            .header("User-Agent", "SignApps/1.0")
            .form(&[
                ("api_type", "json"),
                ("kind", "self"),
                ("sr", &format!("u_{}", self.username)),
                ("title", title),
                ("text", body),
                ("resubmit", "true"),
            ])
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

        let result: SubmitResponse = resp.json().await.map_err(PlatformError::Http)?;

        if let Some(errors) = &result.json.errors {
            if !errors.is_empty() {
                return Err(PlatformError::Other(format!("Reddit errors: {:?}", errors)));
            }
        }

        let data = result
            .json
            .data
            .ok_or_else(|| PlatformError::Other("Reddit: missing data in response".to_string()))?;

        let post_id = data.id.unwrap_or_default();
        let url = data.url;

        Ok(PlatformPost {
            platform_post_id: post_id,
            platform_url: url,
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        let client = reqwest::Client::new();
        // Reddit full name = t3_<id>
        let full_name = if platform_post_id.starts_with("t3_") {
            platform_post_id.to_string()
        } else {
            format!("t3_{}", platform_post_id)
        };

        let resp = client
            .post("https://oauth.reddit.com/api/del")
            .bearer_auth(&self.access_token)
            .header("User-Agent", "SignApps/1.0")
            .form(&[("id", full_name.as_str())])
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

    async fn fetch_comments(&self, platform_post_id: &str) -> PlatformResult<Vec<InboxItem>> {
        let client = reqwest::Client::new();
        let full_name = if platform_post_id.starts_with("t3_") {
            platform_post_id.to_string()
        } else {
            format!("t3_{}", platform_post_id)
        };

        let url = format!(
            "https://oauth.reddit.com/comments/{}?depth=1&limit=100",
            platform_post_id.trim_start_matches("t3_")
        );

        let resp = client
            .get(&url)
            .bearer_auth(&self.access_token)
            .header("User-Agent", "SignApps/1.0")
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            return Ok(vec![]);
        }

        let data: serde_json::Value = resp.json().await.unwrap_or_default();
        let mut items = Vec::new();

        // Reddit returns [post_listing, comment_listing]
        if let Some(comments) = data.get(1).and_then(|v| v["data"]["children"].as_array()) {
            for child in comments {
                let c = &child["data"];
                let kind = child["kind"].as_str().unwrap_or("");
                if kind != "t1" {
                    continue;
                }
                items.push(InboxItem {
                    id: Uuid::new_v4(),
                    account_id: Uuid::nil(),
                    platform_item_id: c["id"].as_str().map(|s| format!("t1_{}", s)),
                    item_type: "comment".to_string(),
                    author_name: c["author"].as_str().map(str::to_string),
                    author_avatar: None,
                    content: c["body"].as_str().map(str::to_string),
                    post_id: None,
                    parent_id: None,
                    is_read: false,
                    sentiment: None,
                    received_at: chrono::Utc::now(),
                    created_at: chrono::Utc::now(),
                });
            }
        }

        let _ = full_name; // suppress warning
        Ok(items)
    }

    async fn reply(&self, item_id: &str, content: &str) -> PlatformResult<()> {
        let client = reqwest::Client::new();
        // item_id should be a full name like t1_<id> or t3_<id>
        let resp = client
            .post("https://oauth.reddit.com/api/comment")
            .bearer_auth(&self.access_token)
            .header("User-Agent", "SignApps/1.0")
            .form(&[
                ("api_type", "json"),
                ("thing_id", item_id),
                ("text", content),
            ])
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

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        let client = reqwest::Client::new();
        let url = format!("https://oauth.reddit.com/user/{}/about", self.username);

        let resp = client
            .get(&url)
            .bearer_auth(&self.access_token)
            .header("User-Agent", "SignApps/1.0")
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
        let karma = data["data"]["link_karma"].as_i64().unwrap_or(0) as i32;

        Ok(AccountAnalytics {
            followers: 0,
            following: 0,
            posts_count: 0,
            impressions: 0,
            reach: karma,
            engagement: karma,
        })
    }
}
