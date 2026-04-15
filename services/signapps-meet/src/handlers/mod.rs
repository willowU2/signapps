//! Meet service HTTP handlers

pub mod openapi;
pub mod participants;
pub mod recordings;
pub mod remote;
pub mod rooms;
pub mod tokens;
pub mod transcription;
pub mod video_messages;
pub mod voicemails;
pub mod waiting_room;

use axum::{extract::State, Json};

use crate::{models::ConfigResponse, AppState};

/// Get meet service configuration
#[utoipa::path(
    get,
    path = "/api/v1/meet/config",
    responses(
        (status = 200, description = "Meet service configuration", body = ConfigResponse),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_config(State(state): State<AppState>) -> Json<ConfigResponse> {
    Json(ConfigResponse {
        livekit_url: state.livekit.base_url.clone(),
        max_participants_per_room: 100,
        recording_enabled: true,
    })
}
