use async_trait::async_trait;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Facebook Graph API — stub (credentials not yet configured).
pub struct FacebookClient;

#[async_trait]
impl SocialPlatform for FacebookClient {
    async fn publish(&self, _content: &str, _media: &[String]) -> PlatformResult<PlatformPost> {
        Err(PlatformError::NotConfigured(
            "Facebook Graph API credentials not configured".to_string(),
        ))
    }

    async fn delete_post(&self, _platform_post_id: &str) -> PlatformResult<()> {
        Err(PlatformError::NotConfigured(
            "Facebook Graph API credentials not configured".to_string(),
        ))
    }

    async fn fetch_comments(&self, _platform_post_id: &str) -> PlatformResult<Vec<InboxItem>> {
        Err(PlatformError::NotConfigured(
            "Facebook Graph API credentials not configured".to_string(),
        ))
    }

    async fn reply(&self, _item_id: &str, _content: &str) -> PlatformResult<()> {
        Err(PlatformError::NotConfigured(
            "Facebook Graph API credentials not configured".to_string(),
        ))
    }

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        Err(PlatformError::NotConfigured(
            "Facebook Graph API credentials not configured".to_string(),
        ))
    }
}
