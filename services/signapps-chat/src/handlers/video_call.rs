//! Handler for starting a Meet video call from a chat channel thread.
//!
//! Creates an instant Meet room (via signapps-meet), posts a system
//! message in the channel announcing the call, and publishes a
//! `chat.video_call.started` event on the PgEventBus so other services
//! (e.g. signapps-notifications) can react.

use crate::state::{broadcast, AppState};
use crate::types::{ChatMessage, MessageRow};
use axum::{
    extract::{Extension, Path, State},
    http::{header::AUTHORIZATION, HeaderMap},
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::error::Error as AppError;
use signapps_common::pg_events::NewEvent;
use signapps_common::Claims;
use uuid::Uuid;

/// Response returned after successfully starting a Meet call from a thread.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct StartVideoCallResponse {
    /// 6-digit Meet room code.
    pub code: String,
    /// Full join URL (relative path `/meet/<code>`).
    pub url: String,
    /// UUID of the system message inserted into the thread.
    pub message_id: Uuid,
}

/// Response payload from signapps-meet's instant-room endpoint.
#[derive(Debug, Deserialize)]
struct MeetInstantResponse {
    code: String,
    #[allow(dead_code)]
    token: String,
    #[allow(dead_code)]
    url: String,
}

/// Start a Meet video call inside a chat channel (thread).
///
/// Creates an instant Meet room via signapps-meet, then posts a system
/// message in the channel with the join link. Publishes
/// `chat.video_call.started` on the PgEventBus so notification consumers
/// can alert the other members.
///
/// # Errors
///
/// * `403` — caller is not a member (nor creator) of the channel.
/// * `404` — channel does not exist.
/// * `502` — signapps-meet rejected the instant-room request.
/// * `500` — database failure while inserting the system message.
#[utoipa::path(
    post,
    path = "/api/v1/chat/threads/{thread_id}/start-video-call",
    params(
        ("thread_id" = Uuid, Path, description = "Channel (thread) UUID"),
    ),
    responses(
        (status = 200, description = "Video call started"),
        (status = 403, description = "Not a member of the thread"),
        (status = 404, description = "Thread not found"),
        (status = 502, description = "Meet service unavailable"),
    ),
    security(("bearerAuth" = [])),
    tag = "chat-meet"
)]
#[tracing::instrument(skip(state, headers), fields(user_id = %claims.sub))]
pub async fn start_video_call(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(thread_id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<Json<StartVideoCallResponse>, AppError> {
    // 1. Verify the thread (channel) exists and that the caller is a member.
    let is_member: bool = sqlx::query_scalar(
        "SELECT EXISTS( \
             SELECT 1 FROM chat.channels c \
             WHERE c.id = $1 \
               AND (c.created_by = $2 \
                    OR c.id IN (SELECT channel_id FROM chat.channel_members \
                                WHERE user_id = $2)))",
    )
    .bind(thread_id)
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::Database(e.to_string()))?;

    if !is_member {
        return Err(AppError::Forbidden(
            "not a member of the thread or thread does not exist".into(),
        ));
    }

    // 2. Forward the caller's bearer token to signapps-meet so it
    // authenticates as the same user.
    let bearer = headers
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or(AppError::Unauthorized)?
        .to_string();

    let meet_base =
        std::env::var("MEET_SERVICE_URL").unwrap_or_else(|_| "http://localhost:3014".to_string());
    let meet_url = format!(
        "{}/api/v1/meet/rooms/instant",
        meet_base.trim_end_matches('/')
    );

    let client = reqwest::Client::new();
    let resp = client
        .post(&meet_url)
        .header(AUTHORIZATION, bearer)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(?e, "failed to reach signapps-meet");
            AppError::ExternalService("meet service unreachable".into())
        })?;

    if !resp.status().is_success() {
        let code = resp.status();
        let body = resp.text().await.unwrap_or_default();
        tracing::error!(status = %code, body = %body, "meet service returned error");
        return Err(AppError::ExternalService("meet service error".into()));
    }

    let meet: MeetInstantResponse = resp
        .json()
        .await
        .map_err(|e| AppError::ExternalService(format!("invalid meet response: {e}")))?;

    let room_url = format!("/meet/{}", meet.code);
    let display_name = if claims.username.is_empty() {
        "Quelqu'un".to_string()
    } else {
        claims.username.clone()
    };

    // 3. Insert a system message carrying the join link. We embed a JSON
    // marker in the attachment column so the UI can render a rich card.
    let system_body = format!("📹 {display_name} a démarré un appel vidéo — Rejoindre: {room_url}");
    let attachment = serde_json::json!({
        "message_type": "system_video_call",
        "room_code": meet.code,
        "url": room_url,
        "initiator_id": claims.sub,
        "initiator_name": display_name,
    });

    let row = sqlx::query_as::<_, MessageRow>(
        r#"
        INSERT INTO chat.messages
            (channel_id, user_id, username, content, attachment)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, channel_id, user_id, username, content, parent_id,
                  reactions, attachment, is_pinned, created_at, updated_at
        "#,
    )
    .bind(thread_id)
    .bind(claims.sub)
    .bind(&display_name)
    .bind(&system_body)
    .bind(&attachment)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "failed to insert system video-call message");
        AppError::Database(e.to_string())
    })?;

    let message: ChatMessage = row.into();
    let message_id = message.id;

    // Broadcast over the internal WS bus so connected clients see the
    // system message instantly.
    broadcast(
        &state,
        "new_message",
        serde_json::json!({ "message": message }),
    );

    // 4. Publish `chat.video_call.started` so signapps-notifications
    // creates `meet.invited` notifications for the other members.
    if let Err(e) = state
        .event_bus
        .publish(NewEvent {
            event_type: "chat.video_call.started".into(),
            aggregate_id: Some(thread_id),
            payload: serde_json::json!({
                "thread_id": thread_id,
                "room_code": meet.code,
                "initiator_id": claims.sub,
                "initiator_name": display_name,
                "message_id": message_id,
                "link": room_url,
            }),
        })
        .await
    {
        tracing::warn!(?e, "failed to publish chat.video_call.started event");
    }

    Ok(Json(StartVideoCallResponse {
        code: meet.code,
        url: room_url,
        message_id,
    }))
}
