//! WebSocket message types for real-time collaboration

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Presence status message sent to clients
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceMessage {
    pub user_id: Uuid,
    pub username: String,
    pub action: PresenceAction,
    pub editing_item_id: Option<Uuid>,
    pub timestamp: u64,
}

/// Presence action type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PresenceAction {
    #[serde(rename = "join")]
    Join,
    #[serde(rename = "leave")]
    Leave,
    #[serde(rename = "start_editing")]
    StartEditing,
    #[serde(rename = "stop_editing")]
    StopEditing,
    #[serde(rename = "idle")]
    Idle,
}

/// Sync request from client
#[derive(Debug, Clone, Deserialize)]
pub struct SyncRequest {
    pub state_vector: Vec<u8>,
    pub request_id: String,
}

/// Sync response to client
#[derive(Debug, Clone, Serialize)]
pub struct SyncResponse {
    pub update: Vec<u8>,
    pub request_id: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_presence_message_serialization() {
        let msg = PresenceMessage {
            user_id: Uuid::new_v4(),
            username: "Alice".to_string(),
            action: PresenceAction::Join,
            editing_item_id: None,
            timestamp: 1234567890,
        };

        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("join"));
        assert!(json.contains("Alice"));
    }

    #[test]
    fn test_presence_action_variants() {
        assert_eq!(PresenceAction::Join, PresenceAction::Join);
        assert_ne!(PresenceAction::Join, PresenceAction::Leave);
    }
}
