//! Presence handlers (IDEA-136).

use crate::state::{broadcast, AppState};
use crate::types::{PresenceEntry, SetPresenceRequest};
use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use signapps_common::Claims;

/// Get presence entries for all users.
pub async fn get_presence(State(state): State<AppState>) -> impl IntoResponse {
    let entries: Vec<PresenceEntry> = state.presence.iter().map(|e| e.value().clone()).collect();
    Json(entries)
}

/// Set presence status for the authenticated user.
pub async fn set_presence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<SetPresenceRequest>,
) -> impl IntoResponse {
    let entry = PresenceEntry {
        user_id: claims.sub,
        status: payload.status.clone(),
        updated_at: Utc::now().to_rfc3339(),
    };
    state.presence.insert(claims.sub, entry.clone());
    broadcast(
        &state,
        "presence_updated",
        serde_json::to_value(&entry).unwrap_or_default(),
    );
    (
        StatusCode::OK,
        Json(serde_json::to_value(entry).unwrap_or_default()),
    )
}
