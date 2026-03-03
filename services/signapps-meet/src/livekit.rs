//! LiveKit token generation
//!
//! Generates JWT tokens for LiveKit room access

use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};

use crate::LiveKitConfig;

/// LiveKit access token claims
#[derive(Debug, Serialize, Deserialize)]
pub struct LiveKitClaims {
    /// API key (issuer)
    pub iss: String,
    /// Subject (participant identity)
    pub sub: String,
    /// Not before (Unix timestamp)
    pub nbf: i64,
    /// Expiration (Unix timestamp)
    pub exp: i64,
    /// Issued at (Unix timestamp)
    pub iat: i64,
    /// Room name
    pub name: Option<String>,
    /// Video grants
    pub video: VideoGrant,
    /// SHA256 hash of metadata (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
    /// Metadata (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<String>,
}

/// Video grant permissions
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VideoGrant {
    /// Room to join
    #[serde(skip_serializing_if = "Option::is_none")]
    pub room: Option<String>,
    /// Can join room
    #[serde(skip_serializing_if = "Option::is_none")]
    pub room_join: Option<bool>,
    /// Can create room
    #[serde(skip_serializing_if = "Option::is_none")]
    pub room_create: Option<bool>,
    /// Can list rooms
    #[serde(skip_serializing_if = "Option::is_none")]
    pub room_list: Option<bool>,
    /// Can record room
    #[serde(skip_serializing_if = "Option::is_none")]
    pub room_record: Option<bool>,
    /// Is admin
    #[serde(skip_serializing_if = "Option::is_none")]
    pub room_admin: Option<bool>,
    /// Can publish tracks
    #[serde(skip_serializing_if = "Option::is_none")]
    pub can_publish: Option<bool>,
    /// Can subscribe to tracks
    #[serde(skip_serializing_if = "Option::is_none")]
    pub can_subscribe: Option<bool>,
    /// Can publish data messages
    #[serde(skip_serializing_if = "Option::is_none")]
    pub can_publish_data: Option<bool>,
    /// Can update own metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub can_update_own_metadata: Option<bool>,
    /// Hidden participant (not listed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hidden: Option<bool>,
    /// Allowed track sources
    #[serde(skip_serializing_if = "Option::is_none")]
    pub can_publish_sources: Option<Vec<String>>,
}

impl VideoGrant {
    /// Create a new participant grant (can join, publish, subscribe)
    pub fn participant(room_name: &str) -> Self {
        Self {
            room: Some(room_name.to_string()),
            room_join: Some(true),
            can_publish: Some(true),
            can_subscribe: Some(true),
            can_publish_data: Some(true),
            can_update_own_metadata: Some(true),
            ..Default::default()
        }
    }

    /// Create a host/admin grant with full permissions
    pub fn host(room_name: &str) -> Self {
        Self {
            room: Some(room_name.to_string()),
            room_join: Some(true),
            room_admin: Some(true),
            room_record: Some(true),
            can_publish: Some(true),
            can_subscribe: Some(true),
            can_publish_data: Some(true),
            can_update_own_metadata: Some(true),
            ..Default::default()
        }
    }

    /// Create a viewer-only grant (subscribe only)
    #[allow(dead_code)]
    pub fn viewer(room_name: &str) -> Self {
        Self {
            room: Some(room_name.to_string()),
            room_join: Some(true),
            can_publish: Some(false),
            can_subscribe: Some(true),
            can_publish_data: Some(false),
            ..Default::default()
        }
    }

    /// Create a server grant for room management
    #[allow(dead_code)]
    pub fn server() -> Self {
        Self {
            room_create: Some(true),
            room_list: Some(true),
            room_admin: Some(true),
            room_record: Some(true),
            ..Default::default()
        }
    }
}

/// Generate a LiveKit access token
pub fn generate_token(
    config: &LiveKitConfig,
    identity: &str,
    name: Option<&str>,
    grant: VideoGrant,
    metadata: Option<&str>,
    ttl_seconds: i64,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let exp = now + Duration::seconds(ttl_seconds);

    let claims = LiveKitClaims {
        iss: config.api_key.clone(),
        sub: identity.to_string(),
        nbf: now.timestamp(),
        exp: exp.timestamp(),
        iat: now.timestamp(),
        name: name.map(|n| n.to_string()),
        video: grant,
        sha256: None,
        metadata: metadata.map(|m| m.to_string()),
    };

    let key = EncodingKey::from_secret(config.api_secret.as_bytes());
    encode(&Header::default(), &claims, &key)
}

/// Generate a participant token for joining a room
pub fn generate_participant_token(
    config: &LiveKitConfig,
    room_name: &str,
    identity: &str,
    display_name: &str,
    is_host: bool,
) -> Result<String, jsonwebtoken::errors::Error> {
    let grant = if is_host {
        VideoGrant::host(room_name)
    } else {
        VideoGrant::participant(room_name)
    };

    // Include display name in metadata as JSON
    let metadata = serde_json::json!({
        "displayName": display_name
    })
    .to_string();

    generate_token(
        config,
        identity,
        Some(display_name),
        grant,
        Some(&metadata),
        3600 * 4, // 4 hours
    )
}

/// Generate a server token for room management operations
#[allow(dead_code)]
pub fn generate_server_token(config: &LiveKitConfig) -> Result<String, jsonwebtoken::errors::Error> {
    generate_token(
        config,
        "server",
        None,
        VideoGrant::server(),
        None,
        60, // 1 minute
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_participant_token() {
        let config = LiveKitConfig {
            api_key: "test-key".to_string(),
            api_secret: "test-secret".to_string(),
            server_url: "ws://localhost:7880".to_string(),
        };

        let token = generate_participant_token(
            &config,
            "test-room",
            "user-123",
            "Test User",
            false,
        )
        .unwrap();

        assert!(!token.is_empty());
        // Token should have 3 parts separated by dots
        assert_eq!(token.split('.').count(), 3);
    }

    #[test]
    fn test_generate_host_token() {
        let config = LiveKitConfig {
            api_key: "test-key".to_string(),
            api_secret: "test-secret".to_string(),
            server_url: "ws://localhost:7880".to_string(),
        };

        let token = generate_participant_token(
            &config,
            "test-room",
            "host-123",
            "Host User",
            true,
        )
        .unwrap();

        assert!(!token.is_empty());
    }
}
