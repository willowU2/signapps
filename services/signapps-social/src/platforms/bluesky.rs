use async_trait::async_trait;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Bluesky AT Protocol client.
pub struct BlueskyClient {
    pub pds_url: String,
    pub did: String,
    pub access_jwt: String,
    http: reqwest::Client,
}

impl BlueskyClient {
    pub fn new(
        pds_url: impl Into<String>,
        did: impl Into<String>,
        access_jwt: impl Into<String>,
    ) -> Self {
        Self {
            pds_url: pds_url.into(),
            did: did.into(),
            access_jwt: access_jwt.into(),
            http: reqwest::Client::new(),
        }
    }

    fn xrpc(&self, method: &str) -> String {
        format!("{}/xrpc/{}", self.pds_url.trim_end_matches('/'), method)
    }

    fn bearer(&self) -> String {
        format!("Bearer {}", self.access_jwt)
    }
}

// ---------- serde helpers --------------------------------------------------

#[derive(Debug, Serialize)]
struct CreateRecordBody {
    repo: String,
    collection: String,
    record: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct CreateRecordResponse {
    uri: String,
    #[allow(dead_code)]
    cid: String,
}

#[derive(Debug, Deserialize)]
struct GetProfileResponse {
    #[serde(rename = "followersCount")]
    followers_count: Option<i32>,
    #[serde(rename = "followsCount")]
    follows_count: Option<i32>,
    #[serde(rename = "postsCount")]
    posts_count: Option<i32>,
}

// ---------- trait impl -----------------------------------------------------

#[async_trait]
impl SocialPlatform for BlueskyClient {
    async fn publish(&self, content: &str, _media: &[String]) -> PlatformResult<PlatformPost> {
        let now = Utc::now().to_rfc3339();
        let body = CreateRecordBody {
            repo: self.did.clone(),
            collection: "app.bsky.feed.post".to_string(),
            record: serde_json::json!({
                "$type": "app.bsky.feed.post",
                "text": content,
                "createdAt": now,
            }),
        };

        let resp = self
            .http
            .post(self.xrpc("com.atproto.repo.createRecord"))
            .header("Authorization", self.bearer())
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let message = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api { status, message });
        }

        let rec: CreateRecordResponse = resp.json().await?;
        // Construct a bsky.app URL from the AT URI (at://did:plc:.../rkey)
        let platform_url = rec
            .uri
            .rsplit('/')
            .next()
            .map(|rkey| format!("https://bsky.app/profile/{}/post/{}", self.did, rkey));

        Ok(PlatformPost {
            platform_post_id: rec.uri,
            platform_url,
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        // platform_post_id is an AT URI: at://did:plc:.../app.bsky.feed.post/rkey
        let rkey = platform_post_id
            .rsplit('/')
            .next()
            .ok_or_else(|| PlatformError::Other("Invalid AT URI".to_string()))?;

        let body = serde_json::json!({
            "repo": self.did,
            "collection": "app.bsky.feed.post",
            "rkey": rkey,
        });

        let resp = self
            .http
            .post(self.xrpc("com.atproto.repo.deleteRecord"))
            .header("Authorization", self.bearer())
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let message = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api { status, message });
        }
        Ok(())
    }

    async fn fetch_comments(&self, _platform_post_id: &str) -> PlatformResult<Vec<InboxItem>> {
        // AT Protocol thread fetching
        let resp = self
            .http
            .get(self.xrpc("app.bsky.feed.getPostThread"))
            .header("Authorization", self.bearer())
            .query(&[("uri", _platform_post_id), ("depth", "10")])
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let message = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api { status, message });
        }

        let data: serde_json::Value = resp.json().await?;
        let mut items = Vec::new();

        if let Some(replies) = data["thread"]["replies"].as_array() {
            for reply in replies {
                let post = &reply["post"];
                let author = &post["author"];
                items.push(InboxItem {
                    id: Uuid::new_v4(),
                    account_id: Uuid::nil(),
                    platform_item_id: post["uri"].as_str().map(str::to_string),
                    item_type: "reply".to_string(),
                    author_name: author["displayName"].as_str().map(str::to_string),
                    author_avatar: author["avatar"].as_str().map(str::to_string),
                    content: post["record"]["text"].as_str().map(str::to_string),
                    post_id: None,
                    parent_id: None,
                    is_read: false,
                    sentiment: None,
                    received_at: Utc::now(),
                    created_at: Utc::now(),
                });
            }
        }

        Ok(items)
    }

    async fn reply(&self, item_id: &str, content: &str) -> PlatformResult<()> {
        let now = Utc::now().to_rfc3339();
        let body = CreateRecordBody {
            repo: self.did.clone(),
            collection: "app.bsky.feed.post".to_string(),
            record: serde_json::json!({
                "$type": "app.bsky.feed.post",
                "text": content,
                "createdAt": now,
                "reply": {
                    "root": { "uri": item_id, "cid": "" },
                    "parent": { "uri": item_id, "cid": "" },
                },
            }),
        };

        let resp = self
            .http
            .post(self.xrpc("com.atproto.repo.createRecord"))
            .header("Authorization", self.bearer())
            .json(&body)
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
            .get(self.xrpc("app.bsky.actor.getProfile"))
            .header("Authorization", self.bearer())
            .query(&[("actor", self.did.as_str())])
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let message = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api { status, message });
        }

        let profile: GetProfileResponse = resp.json().await?;
        Ok(AccountAnalytics {
            followers: profile.followers_count.unwrap_or(0),
            following: profile.follows_count.unwrap_or(0),
            posts_count: profile.posts_count.unwrap_or(0),
            impressions: 0,
            reach: 0,
            engagement: 0,
        })
    }
}
