//! OpenAPI documentation for the signapps-meet service.

use utoipa::{
    openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme},
    Modify, OpenApi,
};
use utoipa_swagger_ui::SwaggerUi;

struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            );
        }
    }
}

#[derive(OpenApi)]
#[openapi(
    paths(
        // Config
        crate::handlers::get_config,
        // Rooms
        crate::handlers::rooms::list_rooms,
        crate::handlers::rooms::create_room,
        crate::handlers::rooms::get_room,
        crate::handlers::rooms::update_room,
        crate::handlers::rooms::delete_room,
        crate::handlers::rooms::end_room,
        crate::handlers::rooms::list_history,
        // Tokens
        crate::handlers::tokens::get_token,
        crate::handlers::tokens::get_room_token,
        // Participants
        crate::handlers::participants::list_participants,
        crate::handlers::participants::kick_participant,
        crate::handlers::participants::mute_participant,
        // Recordings
        crate::handlers::recordings::list_recordings,
        crate::handlers::recordings::start_recording,
        crate::handlers::recordings::get_recording,
        crate::handlers::recordings::stop_recording,
        crate::handlers::recordings::get_active_recording,
        crate::handlers::recordings::get_active_recording_by_code,
        crate::handlers::recordings::stop_room_recording,
        crate::handlers::recordings::start_room_recording_by_code,
        crate::handlers::recordings::stop_room_recording_by_code,
        crate::handlers::recordings::delete_recording,
        // Waiting room (legacy — user_id indexed)
        crate::handlers::waiting_room::list_waiting,
        crate::handlers::waiting_room::admit_user,
        crate::handlers::waiting_room::deny_user,
        crate::handlers::waiting_room::join_waiting_room,
        // Lobby (DB-backed knock flow — identity indexed)
        crate::handlers::lobby::get_lobby,
        crate::handlers::lobby::knock,
        crate::handlers::lobby::knock_status,
        crate::handlers::lobby::list_knocks,
        crate::handlers::lobby::admit,
        crate::handlers::lobby::deny,
        // Raise hand (Phase 3c)
        crate::handlers::raised_hands::raise_hand,
        crate::handlers::raised_hands::lower_hand,
        crate::handlers::raised_hands::lower_other_hand,
        crate::handlers::raised_hands::list_raised_hands,
        // Polls (Phase 3c)
        crate::handlers::polls::create_poll,
        crate::handlers::polls::list_polls,
        crate::handlers::polls::vote_poll,
        crate::handlers::polls::close_poll,
        // Transcription
        crate::handlers::transcription::handle_session_ended,
        crate::handlers::transcription::ingest_transcription,
        crate::handlers::transcription::list_transcription_history,
        crate::handlers::transcription::export_transcription,
        // Video messages
        crate::handlers::video_messages::list_video_messages,
        crate::handlers::video_messages::create_video_message,
        crate::handlers::video_messages::mark_video_message_read,
        crate::handlers::video_messages::delete_video_message,
        // Voicemails
        crate::handlers::voicemails::list_voicemails,
        crate::handlers::voicemails::mark_voicemail_read,
        crate::handlers::voicemails::delete_voicemail,
        // Remote desktop connections
        crate::handlers::remote::list_connections,
        crate::handlers::remote::create_connection,
        crate::handlers::remote::get_connection,
        crate::handlers::remote::update_connection,
        crate::handlers::remote::delete_connection,
        crate::handlers::remote::connection_gateway_ws,
    ),
    components(schemas(
        crate::models::CreateRoomRequest,
        crate::models::UpdateRoomRequest,
        crate::models::RoomResponse,
        crate::models::JoinRoomRequest,
        crate::models::TokenResponse,
        crate::models::ParticipantResponse,
        crate::models::MuteRequest,
        crate::models::RecordingResponse,
        crate::models::MeetingHistoryResponse,
        crate::models::ConfigResponse,
        crate::handlers::tokens::TokenQuery,
        crate::handlers::waiting_room::WaitingRoomResponse,
        crate::handlers::waiting_room::JoinWaitingRoomRequest,
        crate::handlers::lobby::LobbyInfo,
        crate::handlers::lobby::KnockRequest,
        crate::handlers::lobby::KnockResponse,
        crate::handlers::lobby::KnockEntry,
        crate::handlers::lobby::KnockStatus,
        crate::handlers::lobby::KnockStatusResponse,
        crate::handlers::raised_hands::RaisedHand,
        crate::handlers::raised_hands::RaiseHandResponse,
        crate::handlers::raised_hands::LowerHandResponse,
        crate::handlers::polls::Poll,
        crate::handlers::polls::CreatePollRequest,
        crate::handlers::polls::VotePollRequest,
        crate::handlers::transcription::SessionEndedEvent,
        crate::handlers::transcription::IngestTranscriptionRequest,
        crate::handlers::transcription::IngestTranscriptionResponse,
        crate::handlers::transcription::TranscriptionEntry,
        crate::handlers::video_messages::VideoMessage,
        crate::handlers::video_messages::CreateVideoMessageRequest,
        crate::handlers::voicemails::Voicemail,
        crate::models::remote::RemoteConnection,
        crate::models::remote::CreateConnectionRequest,
        crate::models::remote::UpdateConnectionRequest,
    )),
    modifiers(&SecurityAddon),
    info(
        title = "SignApps Meet",
        version = "1.0.0",
        description = "Real-time service — video conferencing (rooms, participants, recordings, waiting room, tokens) and remote desktop (Guacamole protocol)"
    )
)]
pub struct MeetApiDoc;

/// Returns a router that serves Swagger UI and the OpenAPI JSON schema.
pub fn swagger_router() -> SwaggerUi {
    SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", MeetApiDoc::openapi())
}
