//! Domain types, DTOs, and conversion impls for the chat service.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
/// Represents a channel.
pub struct Channel {
    pub id: Uuid,
    pub name: String,
    pub topic: Option<String>,
    pub is_private: bool,
    pub created_by: Uuid,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents a chat message.
pub struct ChatMessage {
    pub id: Uuid,
    pub channel_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub content: String,
    pub parent_id: Option<Uuid>,
    pub reactions: serde_json::Value,
    pub attachment: Option<Attachment>,
    pub is_pinned: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// sqlx row shape for chat.messages (attachment stored as JSONB)
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct MessageRow {
    pub id: Uuid,
    pub channel_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub content: String,
    pub parent_id: Option<Uuid>,
    pub reactions: serde_json::Value,
    pub attachment: Option<serde_json::Value>,
    pub is_pinned: bool,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

impl From<MessageRow> for ChatMessage {
    fn from(r: MessageRow) -> Self {
        let attachment = r
            .attachment
            .and_then(|v| serde_json::from_value::<Attachment>(v).ok());
        Self {
            id: r.id,
            channel_id: r.channel_id,
            user_id: r.user_id,
            username: r.username,
            content: r.content,
            parent_id: r.parent_id,
            reactions: r.reactions,
            attachment,
            is_pinned: r.is_pinned,
            created_at: r.created_at.to_rfc3339(),
            updated_at: r.updated_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents a attachment.
pub struct Attachment {
    pub url: String,
    pub filename: String,
    pub content_type: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents a direct message room.
pub struct DirectMessageRoom {
    pub id: Uuid,
    pub participants: Vec<DmParticipant>,
    pub created_at: String,
    pub last_message_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents a dm participant.
pub struct DmParticipant {
    pub user_id: Uuid,
    pub username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents a presence entry.
pub struct PresenceEntry {
    pub user_id: Uuid,
    pub status: String, // "online" | "away" | "busy" | "offline"
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents a read status.
pub struct ReadStatus {
    pub channel_id: Uuid,
    pub user_id: Uuid,
    pub unread_count: u64,
    pub last_read_at: String,
}

// ---------------------------------------------------------------------------
// Request / Response DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
/// Request payload for CreateChannel operation.
pub struct CreateChannelRequest {
    pub name: String,
    pub topic: Option<String>,
    pub is_private: Option<bool>,
}

#[derive(Debug, Deserialize)]
/// Request payload for UpdateChannel operation — all fields optional.
pub struct UpdateChannelRequest {
    pub name: Option<String>,
    pub topic: Option<String>,
    pub is_private: Option<bool>,
}

#[derive(Debug, Deserialize)]
/// Request payload for SendMessage operation.
pub struct SendMessageRequest {
    pub content: String,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
/// Request payload for AddReaction operation.
pub struct AddReactionRequest {
    pub emoji: String,
}

#[derive(Debug, Deserialize)]
/// Request payload for EditMessage operation.
pub struct EditMessageRequest {
    pub content: String,
}

#[derive(Debug, Deserialize)]
/// Request payload for CreateDm operation.
pub struct CreateDmRequest {
    pub participant_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
/// Request payload for SetPresence operation.
pub struct SetPresenceRequest {
    pub status: String,
}

#[derive(Debug, Deserialize)]
/// Query parameters for filtering and pagination.
pub struct SearchQuery {
    pub q: String,
}

#[derive(Debug, Deserialize)]
/// Query parameters for filtering and pagination.
pub struct ExportQuery {
    pub format: Option<String>, // "json" or "csv"
}

/// Envelope broadcast over WebSocket and the broadcast channel.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub payload: serde_json::Value,
}
