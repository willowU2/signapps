use async_trait::async_trait;
use serde::Deserialize;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// YouTube Data API v3 client.
/// `access_token` is an OAuth2 token with youtube.upload and youtube.readonly scopes.
/// `channel_id` is the YouTube channel ID (UCxxxxxxxx).
pub struct YouTubeClient {
    pub access_token: String,
    pub channel_id: String,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct YtVideoId {
    #[serde(rename = "videoId")]
    video_id: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct YtSnippet {
    title: Option<String>,
    description: Option<String>,
}

#[derive(Deserialize)]
struct YtInsertResponse {
    id: Option<String>,
}

#[derive(Deserialize)]
struct YtChannelStatistics {
    #[serde(rename = "subscriberCount")]
    subscriber_count: Option<String>,
    #[serde(rename = "videoCount")]
    video_count: Option<String>,
    #[serde(rename = "viewCount")]
    view_count: Option<String>,
}

#[derive(Deserialize)]
struct YtChannelItem {
    statistics: Option<YtChannelStatistics>,
}

#[derive(Deserialize)]
struct YtChannelsResponse {
    items: Option<Vec<YtChannelItem>>,
}

#[derive(Deserialize)]
struct YtComment {
    id: Option<String>,
    snippet: Option<YtCommentSnippet>,
}

#[derive(Deserialize)]
struct YtCommentSnippet {
    #[serde(rename = "topLevelComment")]
    top_level_comment: Option<YtTopLevelComment>,
}

#[derive(Deserialize)]
struct YtTopLevelComment {
    snippet: Option<YtCommentBody>,
}

#[derive(Deserialize)]
struct YtCommentBody {
    #[serde(rename = "textDisplay")]
    text_display: Option<String>,
    #[serde(rename = "authorDisplayName")]
    author_display_name: Option<String>,
    #[serde(rename = "authorProfileImageUrl")]
    author_profile_image_url: Option<String>,
}

#[derive(Deserialize)]
struct YtCommentThreadsResponse {
    items: Option<Vec<YtComment>>,
}

#[async_trait]
impl SocialPlatform for YouTubeClient {
    async fn publish(&self, content: &str, media: &[String]) -> PlatformResult<PlatformPost> {
        let client = reqwest::Client::new();

        // YouTube requires multipart upload for actual video files.
        // For URL-based video, we use the resumable upload API with metadata only
        // (the caller must provide a direct video URL or binary via media field).
        // Here we support the metadata-only insert for community posts / video description update,
        // or a direct URL video upload via the insertWithUploadType=resumable approach.

        let video_url = media.first();

        // Build video resource metadata
        let title = if content.len() > 100 {
            format!("{}...", &content[..97])
        } else {
            content.to_string()
        };

        let video_resource = serde_json::json!({
            "snippet": {
                "title": title,
                "description": content,
                "categoryId": "22"  // People & Blogs
            },
            "status": {
                "privacyStatus": "public",
                "selfDeclaredMadeForKids": false
            }
        });

        if let Some(url) = video_url {
            // Use resumable upload with video URL via fetch
            // First, initiate resumable upload to get upload URL
            let init_resp = client
                .post("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status")
                .bearer_auth(&self.access_token)
                .header("Content-Type", "application/json")
                .header("X-Upload-Content-Type", "video/*")
                .json(&video_resource)
                .send()
                .await
                .map_err(PlatformError::Http)?;

            let status = init_resp.status().as_u16();
            if !init_resp.status().is_success() {
                let body = init_resp.text().await.unwrap_or_default();
                return Err(PlatformError::Api { status, message: body });
            }

            let upload_url = init_resp
                .headers()
                .get("location")
                .and_then(|v| v.to_str().ok())
                .map(String::from)
                .ok_or_else(|| PlatformError::Other("No upload URL in YouTube response".to_string()))?;

            // Fetch video bytes from URL and upload
            let video_bytes = client
                .get(url)
                .send()
                .await
                .map_err(PlatformError::Http)?
                .bytes()
                .await
                .map_err(PlatformError::Http)?;

            let upload_resp = client
                .put(&upload_url)
                .header("Content-Type", "video/*")
                .body(video_bytes)
                .send()
                .await
                .map_err(PlatformError::Http)?;

            let status = upload_resp.status().as_u16();
            if !upload_resp.status().is_success() {
                let body = upload_resp.text().await.unwrap_or_default();
                return Err(PlatformError::Api { status, message: body });
            }

            let inserted: YtInsertResponse = upload_resp.json().await.map_err(PlatformError::Http)?;
            let video_id = inserted.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

            return Ok(PlatformPost {
                platform_post_id: video_id.clone(),
                platform_url: Some(format!("https://www.youtube.com/watch?v={}", video_id)),
            });
        }

        // No video: insert a community post (YouTube Community Posts API)
        // This requires the channel to have Community posts enabled
        let community_resp = client
            .post("https://www.googleapis.com/youtube/v3/communityPosts?part=snippet")
            .bearer_auth(&self.access_token)
            .json(&serde_json::json!({
                "snippet": {
                    "type": "text",
                    "textOriginal": content
                }
            }))
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let status = community_resp.status().as_u16();
        if !community_resp.status().is_success() {
            let body = community_resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api { status, message: body });
        }

        let post: YtInsertResponse = community_resp.json().await.map_err(PlatformError::Http)?;
        let post_id = post.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        Ok(PlatformPost {
            platform_post_id: post_id.clone(),
            platform_url: Some(format!(
                "https://www.youtube.com/channel/{}/community",
                self.channel_id
            )),
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        let client = reqwest::Client::new();
        let resp = client
            .delete("https://www.googleapis.com/youtube/v3/videos")
            .bearer_auth(&self.access_token)
            .query(&[("id", platform_post_id)])
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
            .get("https://www.googleapis.com/youtube/v3/commentThreads")
            .bearer_auth(&self.access_token)
            .query(&[
                ("part", "snippet"),
                ("videoId", platform_post_id),
                ("maxResults", "50"),
                ("order", "time"),
            ])
            .send()
            .await
            .map_err(PlatformError::Http)?;

        if !resp.status().is_success() {
            return Ok(vec![]);
        }

        let data: YtCommentThreadsResponse = resp
            .json()
            .await
            .unwrap_or(YtCommentThreadsResponse { items: None });

        let items = data
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|c| {
                let body = c
                    .snippet
                    .and_then(|s| s.top_level_comment)
                    .and_then(|t| t.snippet)?;
                Some(InboxItem {
                    id: uuid::Uuid::new_v4(),
                    account_id: uuid::Uuid::nil(),
                    platform_item_id: c.id,
                    item_type: "comment".to_string(),
                    author_name: body.author_display_name,
                    author_avatar: body.author_profile_image_url,
                    content: body.text_display,
                    post_id: None,
                    parent_id: None,
                    is_read: false,
                    sentiment: None,
                    received_at: chrono::Utc::now(),
                    created_at: chrono::Utc::now(),
                })
            })
            .collect();

        Ok(items)
    }

    async fn reply(&self, item_id: &str, content: &str) -> PlatformResult<()> {
        let client = reqwest::Client::new();
        let resp = client
            .post("https://www.googleapis.com/youtube/v3/comments?part=snippet")
            .bearer_auth(&self.access_token)
            .json(&serde_json::json!({
                "snippet": {
                    "parentId": item_id,
                    "textOriginal": content
                }
            }))
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

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        let client = reqwest::Client::new();
        let resp = client
            .get("https://www.googleapis.com/youtube/v3/channels")
            .bearer_auth(&self.access_token)
            .query(&[
                ("part", "statistics"),
                ("id", &self.channel_id),
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

        let data: YtChannelsResponse = resp
            .json()
            .await
            .unwrap_or(YtChannelsResponse { items: None });

        let stats = data
            .items
            .and_then(|i| i.into_iter().next())
            .and_then(|i| i.statistics)
            .unwrap_or(YtChannelStatistics {
                subscriber_count: None,
                video_count: None,
                view_count: None,
            });

        let parse_stat = |s: Option<String>| -> i32 {
            s.and_then(|v| v.parse::<i32>().ok()).unwrap_or(0)
        };

        Ok(AccountAnalytics {
            followers: parse_stat(stats.subscriber_count),
            following: 0,
            posts_count: parse_stat(stats.video_count),
            impressions: parse_stat(stats.view_count),
            reach: 0,
            engagement: 0,
        })
    }
}
