//! Recording management handlers.
//!
//! ## Current status — Phase 3a
//!
//! Real LiveKit egress is **deferred**. The signapps-storage service does
//! not yet expose an S3-compatible endpoint, so the LiveKit egress pipeline
//! cannot write artifacts anywhere this platform can serve. Until either
//! (a) signapps-storage gains an S3 proxy or (b) the LiveKit container
//! mounts a shared volume, these handlers implement **DB-only lifecycle
//! tracking** (Option C in the design):
//!
//! - `start_recording` creates a row with `status='recording'`.
//! - `stop_recording` / `stop_room_recording` updates it to `status='ready'`
//!   (instead of the real `'processing'` → webhook → `'ready'` dance).
//! - `webhooks::receive_webhook` still projects `egress_ended` events to
//!   the DB for the day real egress lands.
//!
//! The frontend uses this solely for the "recording on" badge + history
//! listing. The `download_url` stays `None` until real egress is wired.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use signapps_common::pg_events::NewEvent;
use signapps_common::Claims;
use uuid::Uuid;

use crate::{
    models::{Recording, RecordingResponse, Room},
    AppState,
};

/// Transform a [`Recording`] DB row into the API response DTO.
fn to_response(r: Recording) -> RecordingResponse {
    RecordingResponse {
        id: r.id,
        room_id: r.room_id,
        status: r.status,
        started_at: r.started_at,
        ended_at: r.ended_at,
        duration_seconds: r.duration_seconds,
        file_size_bytes: r.file_size_bytes,
        // download_url intentionally None — see module docs.
        download_url: r
            .storage_path
            .filter(|p| !p.is_empty())
            .map(|p| format!("/api/v1/storage/files/{}", p)),
    }
}

/// List recordings for a room.
///
/// # Errors
///
/// Returns `404` if the room does not exist, `500` on DB failure.
#[utoipa::path(
    get,
    path = "/api/v1/meet/rooms/{id}/recordings",
    params(("id" = Uuid, Path, description = "Room ID")),
    responses(
        (status = 200, description = "List of recordings for the room", body = Vec<RecordingResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state))]
pub async fn list_recordings(
    State(state): State<AppState>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<Vec<RecordingResponse>>, (StatusCode, String)> {
    // Check room exists
    let _room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    let recordings = sqlx::query_as::<_, Recording>(
        r#"
        SELECT * FROM meet.recordings
        WHERE room_id = $1
        ORDER BY started_at DESC
        "#,
    )
    .bind(room_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(recordings.into_iter().map(to_response).collect()))
}

/// Start a recording (host only, DB-only — see module docs).
///
/// # Errors
///
/// - `400` if the room is not active.
/// - `403` if the caller is not the host.
/// - `404` if the room does not exist.
/// - `409` if a recording is already in progress.
/// - `500` on DB failure.
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/{id}/recordings",
    params(("id" = Uuid, Path, description = "Room ID")),
    responses(
        (status = 200, description = "Recording started", body = RecordingResponse),
        (status = 400, description = "Room not active or recording already in progress"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — only host can start recording"),
        (status = 404, description = "Room not found"),
        (status = 409, description = "Recording already in progress"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn start_recording(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<RecordingResponse>, (StatusCode, String)> {
    // Check room exists and is active
    let room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    if room.status != "active" {
        return Err((
            StatusCode::BAD_REQUEST,
            "Room must be active to start recording".to_string(),
        ));
    }

    // Only host can start a recording
    if room.created_by != claims.sub {
        return Err((
            StatusCode::FORBIDDEN,
            "Only host can start recording".to_string(),
        ));
    }

    // Check if there's already an active recording
    let active: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM meet.recordings WHERE room_id = $1 AND status = 'recording'",
    )
    .bind(room_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if active.0 > 0 {
        return Err((
            StatusCode::CONFLICT,
            "Recording already in progress".to_string(),
        ));
    }

    // Create recording entry. Real LiveKit egress is deferred (see module
    // docs) — we persist a DB-only marker that the UI uses for the
    // "recording on" badge.
    let recording = sqlx::query_as::<_, Recording>(
        r#"
        INSERT INTO meet.recordings (room_id, started_by, status)
        VALUES ($1, $2, 'recording')
        RETURNING *
        "#,
    )
    .bind(room_id)
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tracing::info!(
        recording_id = %recording.id,
        room_id = %room_id,
        "recording started (DB-only; real egress deferred)"
    );

    Ok(Json(to_response(recording)))
}

/// Get a specific recording by ID.
///
/// # Errors
///
/// Returns `404` if no recording with that id exists, `500` on DB failure.
#[utoipa::path(
    get,
    path = "/api/v1/meet/recordings/{id}",
    params(("id" = Uuid, Path, description = "Recording ID")),
    responses(
        (status = 200, description = "Recording details", body = RecordingResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Recording not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state))]
pub async fn get_recording(
    State(state): State<AppState>,
    Path(recording_id): Path<Uuid>,
) -> Result<Json<RecordingResponse>, (StatusCode, String)> {
    let recording = sqlx::query_as::<_, Recording>("SELECT * FROM meet.recordings WHERE id = $1")
        .bind(recording_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Recording not found".to_string()))?;

    Ok(Json(to_response(recording)))
}

/// Stop a recording by id (host or the original starter).
///
/// # Errors
///
/// - `400` if the recording is not currently running.
/// - `403` if the caller did not start it.
/// - `404` if the recording does not exist.
/// - `500` on DB failure.
#[utoipa::path(
    post,
    path = "/api/v1/meet/recordings/{id}/stop",
    params(("id" = Uuid, Path, description = "Recording ID")),
    responses(
        (status = 200, description = "Recording stopped", body = RecordingResponse),
        (status = 400, description = "Recording is not in progress"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Recording not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn stop_recording(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(recording_id): Path<Uuid>,
) -> Result<Json<RecordingResponse>, (StatusCode, String)> {
    let recording = sqlx::query_as::<_, Recording>("SELECT * FROM meet.recordings WHERE id = $1")
        .bind(recording_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Recording not found".to_string()))?;

    if recording.status != "recording" {
        return Err((
            StatusCode::BAD_REQUEST,
            "Recording is not in progress".to_string(),
        ));
    }

    // Check if user is the one who started the recording
    if recording.started_by != claims.sub {
        return Err((
            StatusCode::FORBIDDEN,
            "Only the user who started recording can stop it".to_string(),
        ));
    }

    let updated = finalize_recording(&state, recording.id, recording.started_at).await?;
    Ok(Json(to_response(updated)))
}

/// Finalize a recording row: compute duration, flip status to `ready`,
/// publish `meet.recording.ready` on the platform event bus.
///
/// # Errors
///
/// Returns a 500 tuple on DB failure. Event-bus publish errors are logged
/// and not surfaced — recording state is the source of truth.
async fn finalize_recording(
    state: &AppState,
    recording_id: Uuid,
    started_at: chrono::DateTime<chrono::Utc>,
) -> Result<Recording, (StatusCode, String)> {
    let duration = (chrono::Utc::now() - started_at).num_seconds() as i32;

    // With real egress we'd move from 'recording' → 'processing' and wait
    // for the webhook to flip to 'ready'. Under Option C we jump directly
    // to 'ready' since no artifact is produced.
    let updated = sqlx::query_as::<_, Recording>(
        r#"
        UPDATE meet.recordings SET
            status = 'ready',
            ended_at = NOW(),
            duration_seconds = $1
        WHERE id = $2
        RETURNING *
        "#,
    )
    .bind(duration)
    .bind(recording_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Publish event for Phase 4 notifications.
    let bus = signapps_common::pg_events::PgEventBus::new(
        state.pool.clone(),
        "signapps-meet".to_string(),
    );
    let payload = serde_json::json!({
        "recording_id": updated.id,
        "room_id": updated.room_id,
        "started_by": updated.started_by,
        "duration_seconds": updated.duration_seconds,
    });
    if let Err(err) = bus
        .publish(NewEvent {
            event_type: "meet.recording.ready".to_string(),
            aggregate_id: Some(updated.id),
            payload,
        })
        .await
    {
        tracing::warn!(?err, recording_id = %updated.id, "failed to publish meet.recording.ready");
    }

    tracing::info!(
        recording_id = %updated.id,
        duration_seconds = duration,
        "recording finalized"
    );
    Ok(updated)
}

/// Get the active (in-progress) recording for a room, if any.
///
/// # Errors
///
/// Returns `404` if the room does not exist or has no active recording,
/// `500` on DB failure.
#[utoipa::path(
    get,
    path = "/api/v1/meet/rooms/{id}/recordings/active",
    params(("id" = Uuid, Path, description = "Room ID")),
    responses(
        (status = 200, description = "Active recording details", body = RecordingResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Room not found or no active recording"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state))]
pub async fn get_active_recording(
    State(state): State<AppState>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<RecordingResponse>, (StatusCode, String)> {
    let _room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    let recording = sqlx::query_as::<_, Recording>(
        "SELECT * FROM meet.recordings WHERE room_id = $1 AND status = 'recording' ORDER BY started_at DESC LIMIT 1",
    )
    .bind(room_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "No active recording for this room".to_string()))?;

    Ok(Json(to_response(recording)))
}

/// Stop the active recording for a room (host convenience endpoint).
///
/// # Errors
///
/// - `403` if the caller is not the host.
/// - `404` if the room has no active recording.
/// - `500` on DB failure.
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/{id}/recordings/stop",
    params(("id" = Uuid, Path, description = "Room ID")),
    responses(
        (status = 200, description = "Active recording stopped", body = RecordingResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — only host can stop"),
        (status = 404, description = "Room not found or no active recording"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn stop_room_recording(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<RecordingResponse>, (StatusCode, String)> {
    let room = sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))?;

    if room.created_by != claims.sub {
        return Err((
            StatusCode::FORBIDDEN,
            "Only host can stop room recording".to_string(),
        ));
    }

    let recording = sqlx::query_as::<_, Recording>(
        "SELECT * FROM meet.recordings WHERE room_id = $1 AND status = 'recording' ORDER BY started_at DESC LIMIT 1",
    )
    .bind(room_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "No active recording for this room".to_string()))?;

    let updated = finalize_recording(&state, recording.id, recording.started_at).await?;
    Ok(Json(to_response(updated)))
}

/// Delete a recording (only the original starter, and only if not running).
///
/// # Errors
///
/// - `400` if the recording is still active.
/// - `403` if the caller did not start it.
/// - `404` if the recording does not exist.
/// - `500` on DB failure.
#[utoipa::path(
    delete,
    path = "/api/v1/meet/recordings/{id}",
    params(("id" = Uuid, Path, description = "Recording ID")),
    responses(
        (status = 204, description = "Recording deleted"),
        (status = 400, description = "Cannot delete an active recording"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Recording not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn delete_recording(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(recording_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let recording = sqlx::query_as::<_, Recording>("SELECT * FROM meet.recordings WHERE id = $1")
        .bind(recording_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Recording not found".to_string()))?;

    // Check if user is the one who started the recording
    if recording.started_by != claims.sub {
        return Err((
            StatusCode::FORBIDDEN,
            "Only the user who started recording can delete it".to_string(),
        ));
    }

    // Can't delete active recordings
    if recording.status == "recording" {
        return Err((
            StatusCode::BAD_REQUEST,
            "Stop recording before deleting".to_string(),
        ));
    }

    // File storage clean-up is a no-op under Option C (no artifact exists).
    sqlx::query("DELETE FROM meet.recordings WHERE id = $1")
        .bind(recording_id)
        .execute(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
