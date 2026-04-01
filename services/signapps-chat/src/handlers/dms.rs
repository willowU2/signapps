//! Direct message handlers (IDEA-137, in-memory).

use crate::state::{broadcast, AppState};
use crate::types::{ChatMessage, CreateDmRequest, DirectMessageRoom, DmParticipant, SendMessageRequest};
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use signapps_common::Claims;
use uuid::Uuid;

/// List DM rooms for the authenticated user.
pub async fn list_dms(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let rooms: Vec<DirectMessageRoom> = state
        .dm_rooms
        .iter()
        .filter(|e| {
            e.value()
                .participants
                .iter()
                .any(|p| p.user_id == claims.sub)
        })
        .map(|e| e.value().clone())
        .collect();
    Json(rooms)
}

/// Create or retrieve a DM room.
pub async fn create_dm(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateDmRequest>,
) -> impl IntoResponse {
    // Check if DM room already exists between these participants
    let mut all_ids = payload.participant_ids.clone();
    all_ids.push(claims.sub);
    all_ids.sort();

    for entry in state.dm_rooms.iter() {
        let mut room_ids: Vec<Uuid> = entry
            .value()
            .participants
            .iter()
            .map(|p| p.user_id)
            .collect();
        room_ids.sort();
        if room_ids == all_ids {
            return (
                StatusCode::OK,
                Json(serde_json::to_value(entry.value().clone()).unwrap_or_default()),
            );
        }
    }

    let now = Utc::now().to_rfc3339();
    let mut participants: Vec<DmParticipant> = payload
        .participant_ids
        .iter()
        .map(|id| DmParticipant {
            user_id: *id,
            username: id.to_string(),
        })
        .collect();
    participants.push(DmParticipant {
        user_id: claims.sub,
        username: claims.username.clone(),
    });

    let room = DirectMessageRoom {
        id: Uuid::new_v4(),
        participants,
        created_at: now,
        last_message_at: None,
    };
    let room_id = room.id;
    state.dm_rooms.insert(room_id, room.clone());
    state.dm_messages.insert(room_id, Vec::new());

    (
        StatusCode::CREATED,
        Json(serde_json::to_value(room).unwrap_or_default()),
    )
}

/// Delete a DM room (participant only).
pub async fn delete_dm(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(room_id): Path<Uuid>,
) -> impl IntoResponse {
    match state.dm_rooms.get(&room_id) {
        Some(room) if room.participants.iter().any(|p| p.user_id == claims.sub) => {
            state.dm_rooms.remove(&room_id);
            state.dm_messages.remove(&room_id);
            (StatusCode::NO_CONTENT, Json(serde_json::json!({})))
        },
        Some(_) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Not a participant" })),
        ),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "DM not found" })),
        ),
    }
}

/// List messages in a DM room.
pub async fn list_dm_messages(
    State(state): State<AppState>,
    Path(room_id): Path<Uuid>,
) -> impl IntoResponse {
    match state.dm_messages.get(&room_id) {
        Some(msgs) => (
            StatusCode::OK,
            Json(serde_json::to_value(&*msgs).unwrap_or_default()),
        ),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "DM room not found" })),
        ),
    }
}

/// Send a message in a DM room.
pub async fn send_dm_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(room_id): Path<Uuid>,
    Json(payload): Json<SendMessageRequest>,
) -> impl IntoResponse {
    if !state.dm_rooms.contains_key(&room_id) {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "DM not found" })),
        );
    }

    let now = Utc::now().to_rfc3339();
    let msg = ChatMessage {
        id: Uuid::new_v4(),
        channel_id: room_id,
        user_id: claims.sub,
        username: claims.username.clone(),
        content: payload.content,
        parent_id: None,
        reactions: serde_json::json!({}),
        attachment: None,
        is_pinned: false,
        created_at: now.clone(),
        updated_at: now.clone(),
    };

    state
        .dm_messages
        .entry(room_id)
        .or_default()
        .push(msg.clone());
    if let Some(mut room) = state.dm_rooms.get_mut(&room_id) {
        room.last_message_at = Some(now);
    }

    broadcast(
        &state,
        "new_message",
        serde_json::to_value(&msg).unwrap_or_default(),
    );
    (
        StatusCode::CREATED,
        Json(serde_json::to_value(&msg).unwrap_or_default()),
    )
}
