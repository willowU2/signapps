//! Meet service HTTP handlers

pub mod participants;
pub mod recordings;
pub mod rooms;
pub mod tokens;

use axum::{extract::State, Json};

use crate::{models::ConfigResponse, AppState};

/// Get meet service configuration
pub async fn get_config(State(state): State<AppState>) -> Json<ConfigResponse> {
    Json(ConfigResponse {
        livekit_url: state.livekit_config.server_url.clone(),
        max_participants_per_room: 100,
        recording_enabled: true,
    })
}
