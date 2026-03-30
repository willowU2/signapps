use async_trait::async_trait;

use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

pub mod bluesky;
pub mod facebook;
pub mod instagram;
pub mod linkedin;
pub mod mastodon;
pub mod pinterest;
pub mod threads;
pub mod tiktok;
pub mod twitter;
pub mod youtube;

#[derive(Debug, thiserror::Error)]
/// Error type for Platform operations.
pub enum PlatformError {
    #[error("Platform not configured: {0}")]
    NotConfigured(String),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("API error: {status} — {message}")]
    Api { status: u16, message: String },
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("{0}")]
    Other(String),
}

pub type PlatformResult<T> = Result<T, PlatformError>;

#[async_trait]
pub trait SocialPlatform: Send + Sync {
    async fn publish(&self, content: &str, media: &[String]) -> PlatformResult<PlatformPost>;
    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()>;
    async fn fetch_comments(&self, platform_post_id: &str) -> PlatformResult<Vec<InboxItem>>;
    async fn reply(&self, item_id: &str, content: &str) -> PlatformResult<()>;
    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics>;
}
