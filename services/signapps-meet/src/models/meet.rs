//! Meet service models

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A meeting room
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Room {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_by: Uuid,
    pub room_code: String,
    pub status: String, // "scheduled", "active", "ended"
    pub is_private: bool,
    pub password_hash: Option<String>,
    pub max_participants: Option<i32>,
    pub scheduled_start: Option<DateTime<Utc>>,
    pub scheduled_end: Option<DateTime<Utc>>,
    pub actual_start: Option<DateTime<Utc>>,
    pub actual_end: Option<DateTime<Utc>>,
    pub settings: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Room participant tracking
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RoomParticipant {
    pub id: Uuid,
    pub room_id: Uuid,
    pub user_id: Option<Uuid>,
    pub display_name: String,
    pub role: String, // "host", "moderator", "participant"
    pub joined_at: DateTime<Utc>,
    pub left_at: Option<DateTime<Utc>>,
    pub is_muted: bool,
    pub is_video_off: bool,
    pub is_screen_sharing: bool,
}

/// Recording metadata
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Recording {
    pub id: Uuid,
    pub room_id: Uuid,
    pub started_by: Uuid,
    pub status: String, // "recording", "processing", "ready", "failed"
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i32>,
    pub file_size_bytes: Option<i64>,
    pub storage_path: Option<String>,
    pub storage_bucket: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Meeting history entry (for analytics)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MeetingHistory {
    pub id: Uuid,
    pub room_id: Uuid,
    pub room_name: String,
    pub host_id: Uuid,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i32>,
    pub participant_count: i32,
    pub max_concurrent_participants: i32,
    pub had_recording: bool,
    pub had_screen_share: bool,
}

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateRoom operation.
pub struct CreateRoomRequest {
    pub name: String,
    pub description: Option<String>,
    pub is_private: Option<bool>,
    pub password: Option<String>,
    pub max_participants: Option<i32>,
    pub scheduled_start: Option<DateTime<Utc>>,
    pub scheduled_end: Option<DateTime<Utc>>,
    pub settings: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for UpdateRoom operation.
pub struct UpdateRoomRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_private: Option<bool>,
    pub password: Option<String>,
    pub max_participants: Option<i32>,
    pub scheduled_start: Option<DateTime<Utc>>,
    pub scheduled_end: Option<DateTime<Utc>>,
    pub settings: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response payload for Room operation.
pub struct RoomResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub room_code: String,
    pub status: String,
    pub is_private: bool,
    pub max_participants: Option<i32>,
    pub scheduled_start: Option<DateTime<Utc>>,
    pub scheduled_end: Option<DateTime<Utc>>,
    pub actual_start: Option<DateTime<Utc>>,
    pub actual_end: Option<DateTime<Utc>>,
    pub settings: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub participant_count: i32,
    pub livekit_url: String,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for JoinRoom operation.
pub struct JoinRoomRequest {
    pub password: Option<String>,
    pub display_name: Option<String>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response payload for Token operation.
pub struct TokenResponse {
    pub token: String,
    pub livekit_url: String,
    pub room_name: String,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response payload for Participant operation.
pub struct ParticipantResponse {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub display_name: String,
    pub role: String,
    pub joined_at: DateTime<Utc>,
    pub is_muted: bool,
    pub is_video_off: bool,
    pub is_screen_sharing: bool,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for Mute operation.
pub struct MuteRequest {
    pub audio: Option<bool>,
    pub video: Option<bool>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response payload for Recording operation.
pub struct RecordingResponse {
    pub id: Uuid,
    pub room_id: Uuid,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i32>,
    pub file_size_bytes: Option<i64>,
    pub download_url: Option<String>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response payload for MeetingHistory operation.
pub struct MeetingHistoryResponse {
    pub id: Uuid,
    pub room_name: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i32>,
    pub participant_count: i32,
    pub had_recording: bool,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response payload for Config operation.
pub struct ConfigResponse {
    pub livekit_url: String,
    pub max_participants_per_room: i32,
    pub recording_enabled: bool,
}
