//! Recording management handlers

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use signapps_common::Claims;
use uuid::Uuid;

use crate::{
    models::{Recording, RecordingResponse, Room},
    AppState,
};

/// List recordings for a room
#[tracing::instrument(skip_all)]
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

    Ok(Json(
        recordings
            .into_iter()
            .map(|r| RecordingResponse {
                id: r.id,
                room_id: r.room_id,
                status: r.status,
                started_at: r.started_at,
                ended_at: r.ended_at,
                duration_seconds: r.duration_seconds,
                file_size_bytes: r.file_size_bytes,
                download_url: r
                    .storage_path
                    .map(|p| format!("/api/v1/storage/files/{}", p)),
            })
            .collect(),
    ))
}

/// Start a recording
#[tracing::instrument(skip_all)]
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

    // Check if user is host
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
    .unwrap_or((0,));

    if active.0 > 0 {
        return Err((
            StatusCode::CONFLICT,
            "Recording already in progress".to_string(),
        ));
    }

    // Create recording entry
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

    // In a real implementation, we would start the LiveKit egress here
    // using the LiveKit server SDK

    Ok(Json(RecordingResponse {
        id: recording.id,
        room_id: recording.room_id,
        status: recording.status,
        started_at: recording.started_at,
        ended_at: recording.ended_at,
        duration_seconds: recording.duration_seconds,
        file_size_bytes: recording.file_size_bytes,
        download_url: None,
    }))
}

/// Get a specific recording
#[tracing::instrument(skip_all)]
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

    Ok(Json(RecordingResponse {
        id: recording.id,
        room_id: recording.room_id,
        status: recording.status,
        started_at: recording.started_at,
        ended_at: recording.ended_at,
        duration_seconds: recording.duration_seconds,
        file_size_bytes: recording.file_size_bytes,
        download_url: recording
            .storage_path
            .map(|p| format!("/api/v1/storage/files/{}", p)),
    }))
}

/// Stop a recording
#[tracing::instrument(skip_all)]
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

    // Calculate duration
    let duration = (chrono::Utc::now() - recording.started_at).num_seconds() as i32;

    // Update recording status
    let updated = sqlx::query_as::<_, Recording>(
        r#"
        UPDATE meet.recordings SET
            status = 'processing',
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

    // In a real implementation, we would stop the LiveKit egress here
    // and wait for the file to be processed

    Ok(Json(RecordingResponse {
        id: updated.id,
        room_id: updated.room_id,
        status: updated.status,
        started_at: updated.started_at,
        ended_at: updated.ended_at,
        duration_seconds: updated.duration_seconds,
        file_size_bytes: updated.file_size_bytes,
        download_url: None,
    }))
}

/// Get the active (in-progress) recording for a room
#[tracing::instrument(skip_all)]
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

    Ok(Json(RecordingResponse {
        id: recording.id,
        room_id: recording.room_id,
        status: recording.status,
        started_at: recording.started_at,
        ended_at: recording.ended_at,
        duration_seconds: recording.duration_seconds,
        file_size_bytes: recording.file_size_bytes,
        download_url: recording
            .storage_path
            .map(|p| format!("/api/v1/storage/files/{}", p)),
    }))
}

/// Stop the active recording for a room (host convenience endpoint)
#[tracing::instrument(skip_all)]
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

    let duration = (chrono::Utc::now() - recording.started_at).num_seconds() as i32;

    let updated = sqlx::query_as::<_, Recording>(
        r#"
        UPDATE meet.recordings SET
            status = 'processing',
            ended_at = NOW(),
            duration_seconds = $1
        WHERE id = $2
        RETURNING *
        "#,
    )
    .bind(duration)
    .bind(recording.id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(RecordingResponse {
        id: updated.id,
        room_id: updated.room_id,
        status: updated.status,
        started_at: updated.started_at,
        ended_at: updated.ended_at,
        duration_seconds: updated.duration_seconds,
        file_size_bytes: updated.file_size_bytes,
        download_url: None,
    }))
}

/// Delete a recording
#[tracing::instrument(skip_all)]
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

    // Delete file from storage if exists
    // In a real implementation, we would call the storage service here

    // Delete recording entry
    sqlx::query("DELETE FROM meet.recordings WHERE id = $1")
        .bind(recording_id)
        .execute(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}
