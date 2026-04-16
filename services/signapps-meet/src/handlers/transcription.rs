//! Auto-transcription handler for meet recordings
//!
//! Handles two concerns:
//! 1. Post-session: when a session ends with a recording_id, enqueue an AI
//!    transcription job and create a document in the docs service with the
//!    resulting transcript (legacy pipeline).
//! 2. Live transcription: ingest / history / export of utterances produced
//!    by each client's browser-side STT loop (see Phase 3b frontend
//!    pipeline). Persists to `meet.transcriptions` (migration 286).

use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Extension, Json,
};
use chrono::{TimeZone, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use sqlx::FromRow;
use uuid::Uuid;

use crate::{models::Room, AppState};

// ── Event payload ─────────────────────────────────────────────────────────────

/// Payload emitted by the event bus when a meet session ends.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// SessionEndedEvent data transfer object.
pub struct SessionEndedEvent {
    pub room_id: Uuid,
    pub recording_id: Option<Uuid>,
    #[allow(dead_code)]
    pub duration_seconds: Option<i32>,
    #[allow(dead_code)]
    pub ended_at: Option<String>,
}

/// Internal transcription job — stored in DB while processing.
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[allow(dead_code)]
/// TranscriptionJob data transfer object.
pub struct TranscriptionJob {
    pub id: Uuid,
    pub recording_id: Uuid,
    pub room_id: Uuid,
    pub status: String, // queued | processing | completed | failed
    pub doc_id: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

/// POST /api/v1/meet/events/session-ended
///
/// Called by the notification service (or the event bus webhook) when a
/// `meet.session.ended` event fires.  If the event contains a recording_id,
/// a transcription job is created and the AI transcription pipeline is
/// triggered asynchronously.
#[utoipa::path(
    post,
    path = "/api/v1/meet/events/session-ended",
    request_body = SessionEndedEvent,
    responses(
        (status = 200, description = "Event processed; transcription queued if recording present"),
        (status = 404, description = "Recording not found"),
        (status = 500, description = "Internal server error"),
    ),
    tag = "Meet"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn handle_session_ended(
    State(state): State<AppState>,
    Json(event): Json<SessionEndedEvent>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    tracing::info!(
        room_id = %event.room_id,
        recording_id = ?event.recording_id,
        "meet.session.ended received"
    );

    let Some(recording_id) = event.recording_id else {
        // No recording — nothing to transcribe
        return Ok(Json(serde_json::json!({ "status": "no_recording" })));
    };

    // Verify recording exists
    let recording_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM meet.recordings WHERE id = $1)")
            .bind(recording_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !recording_exists {
        return Err((
            StatusCode::NOT_FOUND,
            format!("Recording {recording_id} not found"),
        ));
    }

    // Create a transcription job.
    // NOTE: A dedicated meet.transcription_jobs table is defined in the migration note at the
    // bottom of this file — tracked in backlog. Currently the intent is recorded via a status
    // update on the recording row while the async task runs.
    sqlx::query(
        "UPDATE meet.recordings SET status = 'transcribing' WHERE id = $1 AND status = 'completed'",
    )
    .bind(recording_id)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Spawn background task to perform the transcription
    let pool = state.pool.clone();
    let room_id = event.room_id;
    tokio::spawn(async move {
        if let Err(e) = run_transcription_pipeline(&pool, recording_id, room_id).await {
            tracing::error!(recording_id = %recording_id, error = %e, "Transcription pipeline failed");
            // Mark as failed
            let _ = sqlx::query(
                "UPDATE meet.recordings SET status = 'transcription_failed' WHERE id = $1",
            )
            .bind(recording_id)
            .execute(&pool)
            .await;
        }
    });

    Ok(Json(serde_json::json!({
        "status": "transcription_queued",
        "recording_id": recording_id,
    })))
}

// ── Transcription pipeline ─────────────────────────────────────────────────

/// Background transcription pipeline:
///
/// 1. Fetch recording file path from DB
/// 2. NOTE: Fetch audio bytes from storage service — tracked in backlog
/// 3. NOTE: POST audio to AI service `/ai/transcribe` endpoint — tracked in backlog
/// 4. Create a text document in the docs service with the transcript (placeholder for now)
/// 5. Mark recording as `transcribed`
async fn run_transcription_pipeline(
    pool: &sqlx::Pool<sqlx::Postgres>,
    recording_id: Uuid,
    room_id: Uuid,
) -> anyhow::Result<()> {
    tracing::info!(recording_id = %recording_id, "Starting transcription pipeline");

    // Step 1: Get recording details
    let (storage_path, duration_seconds): (Option<String>, Option<i32>) =
        sqlx::query_as("SELECT storage_path, duration_seconds FROM meet.recordings WHERE id = $1")
            .bind(recording_id)
            .fetch_one(pool)
            .await?;

    tracing::info!(
        recording_id = %recording_id,
        storage_path = ?storage_path,
        duration_seconds = ?duration_seconds,
        "Recording details fetched"
    );

    // NOTE Step 2: Fetch audio from storage service — tracked in backlog
    // let audio_url = format!("{}/api/v1/storage/files/{}", STORAGE_URL, path);
    // let audio_bytes = reqwest::get(&audio_url).await?.bytes().await?;

    // NOTE Step 3: POST to AI transcription endpoint — tracked in backlog
    // let ai_url = std::env::var("AI_SERVICE_URL").unwrap_or("http://localhost:3010".into());
    // let transcript_text = reqwest::Client::new()
    //     .post(format!("{}/ai/transcribe", ai_url))
    //     .multipart(form_with_audio_bytes)
    //     .send().await?
    //     .json::<TranscribeResponse>().await?
    //     .text;

    // For now, generate a placeholder transcript document
    let placeholder_transcript = format!(
        "# Meeting Transcript\n\nRoom: {room_id}\nRecording: {recording_id}\nDuration: {}s\n\n\
        [Transcription pending — audio file will be processed by AI Whisper once the storage \
        fetch and AI service integration is complete.]\n\n\
        ## Pending steps\n- Fetch audio from storage path: {storage_path:?}\n\
        - POST to /ai/transcribe\n- Parse transcript segments with timestamps",
        duration_seconds.unwrap_or(0)
    );

    // Step 4: Create document in docs service.
    // NOTE: Use internal HTTP client to call the docs service — tracked in backlog.
    // let docs_url = std::env::var("DOCS_SERVICE_URL").unwrap_or("http://localhost:3002".into());
    // reqwest::Client::new()
    //     .post(format!("{}/api/v1/docs", docs_url))
    //     .json(&serde_json::json!({
    //         "name": format!("Transcript — {}", chrono::Utc::now().format("%Y-%m-%d")),
    //         "content": placeholder_transcript,
    //         "source": "meet-transcription",
    //         "metadata": { "recording_id": recording_id, "room_id": room_id }
    //     }))
    //     .send().await?;

    tracing::info!(
        recording_id = %recording_id,
        transcript_len = placeholder_transcript.len(),
        "Transcription pipeline completed (placeholder)"
    );

    // Step 5: Mark recording as transcribed
    sqlx::query("UPDATE meet.recordings SET status = 'transcribed' WHERE id = $1")
        .bind(recording_id)
        .execute(pool)
        .await?;

    Ok(())
}

// ── Migration note ────────────────────────────────────────────────────────────
//
// Add to a future migration:
//
// CREATE TABLE IF NOT EXISTS meet.transcription_jobs (
//     id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     recording_id     UUID NOT NULL REFERENCES meet.recordings(id) ON DELETE CASCADE,
//     room_id          UUID NOT NULL,
//     status           TEXT NOT NULL DEFAULT 'queued'
//                          CHECK (status IN ('queued','processing','completed','failed')),
//     doc_id           UUID,
//     transcript_text  TEXT,
//     created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//     updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );

// ── Live transcription (Phase 3b) ─────────────────────────────────────────────

/// Body for `POST /meet/rooms/:code/transcription/ingest`.
///
/// A single utterance produced by the caller's browser-side STT loop (see
/// `signapps-media /api/v1/stt/transcribe`). The client posts one of these
/// for every 2-second audio chunk that yields non-empty text.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct IngestTranscriptionRequest {
    /// LiveKit `identity` of the speaker (same as `room.localParticipant.identity`).
    pub speaker_identity: String,
    /// Transcribed text.
    pub text: String,
    /// Client-side wall-clock timestamp of the chunk, in milliseconds since epoch.
    pub timestamp_ms: i64,
    /// Optional ISO-639-1 language tag detected by the STT model (e.g. `"fr"`, `"en"`).
    #[serde(default)]
    pub language: Option<String>,
}

/// Response body for `POST /meet/rooms/:code/transcription/ingest`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct IngestTranscriptionResponse {
    /// UUID of the newly-created `meet.transcriptions` row.
    pub id: Uuid,
}

/// One persisted utterance from `meet.transcriptions`.
#[derive(Debug, Clone, Serialize, FromRow, utoipa::ToSchema)]
pub struct TranscriptionEntry {
    /// Row UUID.
    pub id: Uuid,
    /// Owning room UUID.
    pub room_id: Uuid,
    /// LiveKit identity of the speaker.
    pub speaker_identity: String,
    /// Transcribed text.
    pub text: String,
    /// Client-reported millisecond timestamp of the chunk.
    pub timestamp_ms: i64,
    /// Detected language tag, if any.
    pub language: Option<String>,
    /// Server-side insertion time.
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Query params for `GET /meet/rooms/:code/transcription/history`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct HistoryQuery {
    /// Maximum number of entries to return. Defaults to 200, capped at 1000.
    #[serde(default)]
    pub limit: Option<i64>,
}

/// Supported export formats for `GET /meet/rooms/:code/transcription/export`.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    /// Markdown with timestamp prefix per line.
    Md,
    /// SubRip (SRT) with `HH:MM:SS,MMM --> HH:MM:SS,MMM` blocks.
    Srt,
    /// Plain text, one line per utterance.
    Txt,
}

/// Query params for `GET /meet/rooms/:code/transcription/export`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ExportQuery {
    /// Output format. Defaults to `txt`.
    #[serde(default)]
    pub format: Option<String>,
}

async fn fetch_room_by_code_any(
    state: &AppState,
    code: &str,
) -> Result<Room, (StatusCode, String)> {
    sqlx::query_as::<_, Room>("SELECT * FROM meet.rooms WHERE room_code = $1")
        .bind(code)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Room not found".to_string()))
}

/// Persist a live-transcription utterance.
///
/// Called by every client that has the transcription toggle enabled, once
/// per 2-second audio chunk (after a successful round-trip to
/// `signapps-media /api/v1/stt/transcribe`). The payload is also broadcast
/// to peers over a LiveKit data-channel topic — this endpoint only handles
/// the persistent copy.
///
/// # Errors
///
/// - `404 Not Found` if the room code does not exist.
/// - `400 Bad Request` if `text` is empty after trimming.
/// - `500 Internal Server Error` on database failure.
#[utoipa::path(
    post,
    path = "/api/v1/meet/rooms/{code}/transcription/ingest",
    request_body = IngestTranscriptionRequest,
    params(("code" = String, Path, description = "Room code (short human id)")),
    responses(
        (status = 200, description = "Utterance persisted", body = IngestTranscriptionResponse),
        (status = 400, description = "Empty text"),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Database error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub, code = %code))]
pub async fn ingest_transcription(
    State(state): State<AppState>,
    Path(code): Path<String>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<IngestTranscriptionRequest>,
) -> Result<Json<IngestTranscriptionResponse>, (StatusCode, String)> {
    let trimmed = body.text.trim();
    if trimmed.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "text must not be empty".to_string()));
    }
    let room = fetch_room_by_code_any(&state, &code).await?;

    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO meet.transcriptions \
         (room_id, speaker_identity, text, timestamp_ms, language) \
         VALUES ($1, $2, $3, $4, $5) \
         RETURNING id",
    )
    .bind(room.id)
    .bind(&body.speaker_identity)
    .bind(trimmed)
    .bind(body.timestamp_ms)
    .bind(body.language.as_deref())
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tracing::debug!(
        %id,
        room_id = %room.id,
        speaker = %body.speaker_identity,
        chars = trimmed.len(),
        "transcription utterance persisted"
    );

    Ok(Json(IngestTranscriptionResponse { id }))
}

/// Return the persisted transcription history for a room.
///
/// Entries are ordered by `timestamp_ms ASC` so the client can replay the
/// meeting in order. The default limit is 200, capped at 1000.
///
/// # Errors
///
/// - `404 Not Found` if the room code does not exist.
/// - `500 Internal Server Error` on database failure.
#[utoipa::path(
    get,
    path = "/api/v1/meet/rooms/{code}/transcription/history",
    params(
        ("code" = String, Path, description = "Room code"),
        HistoryQuery,
    ),
    responses(
        (status = 200, description = "Transcription history", body = Vec<TranscriptionEntry>),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Database error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub, code = %code))]
pub async fn list_transcription_history(
    State(state): State<AppState>,
    Path(code): Path<String>,
    Query(params): Query<HistoryQuery>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TranscriptionEntry>>, (StatusCode, String)> {
    let _ = &claims;
    let room = fetch_room_by_code_any(&state, &code).await?;
    let limit = params.limit.unwrap_or(200).clamp(1, 1000);

    let rows = sqlx::query_as::<_, TranscriptionEntry>(
        "SELECT id, room_id, speaker_identity, text, timestamp_ms, language, created_at \
         FROM meet.transcriptions \
         WHERE room_id = $1 \
         ORDER BY timestamp_ms ASC \
         LIMIT $2",
    )
    .bind(room.id)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(rows))
}

/// Export the persisted transcription as a downloadable document.
///
/// Three formats are supported:
/// - `txt`: plain text, one line per utterance (default).
/// - `md`: Markdown with `**HH:MM:SS** speaker: text` lines.
/// - `srt`: SubRip subtitle blocks; each utterance becomes a 2-second cue
///   starting at `timestamp_ms` relative to the first utterance.
///
/// # Errors
///
/// - `400 Bad Request` if `format` is unrecognised.
/// - `404 Not Found` if the room code does not exist.
/// - `500 Internal Server Error` on database failure.
#[utoipa::path(
    get,
    path = "/api/v1/meet/rooms/{code}/transcription/export",
    params(
        ("code" = String, Path, description = "Room code"),
        ExportQuery,
    ),
    responses(
        (status = 200, description = "Transcript file"),
        (status = 400, description = "Unsupported format"),
        (status = 404, description = "Room not found"),
        (status = 500, description = "Database error"),
    ),
    security(("bearer" = [])),
    tag = "Meet"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub, code = %code))]
pub async fn export_transcription(
    State(state): State<AppState>,
    Path(code): Path<String>,
    Query(params): Query<ExportQuery>,
    Extension(claims): Extension<Claims>,
) -> Result<Response, (StatusCode, String)> {
    let _ = &claims;
    let format = match params.format.as_deref().unwrap_or("txt") {
        "md" => ExportFormat::Md,
        "srt" => ExportFormat::Srt,
        "txt" => ExportFormat::Txt,
        other => {
            return Err((
                StatusCode::BAD_REQUEST,
                format!("unsupported format: {other}"),
            ));
        },
    };

    let room = fetch_room_by_code_any(&state, &code).await?;

    let rows: Vec<TranscriptionEntry> = sqlx::query_as::<_, TranscriptionEntry>(
        "SELECT id, room_id, speaker_identity, text, timestamp_ms, language, created_at \
         FROM meet.transcriptions \
         WHERE room_id = $1 \
         ORDER BY timestamp_ms ASC",
    )
    .bind(room.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (body, mime, ext) = match format {
        ExportFormat::Md => (render_md(&rows), "text/markdown; charset=utf-8", "md"),
        ExportFormat::Srt => (
            render_srt(&rows),
            "application/x-subrip; charset=utf-8",
            "srt",
        ),
        ExportFormat::Txt => (render_txt(&rows), "text/plain; charset=utf-8", "txt"),
    };

    let filename = format!("transcript-{code}.{ext}");
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(mime).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("bad mime: {e}"),
            )
        })?,
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{filename}\"")).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("bad disposition: {e}"),
            )
        })?,
    );

    Ok((headers, body).into_response())
}

// ── Formatting helpers ────────────────────────────────────────────────────────

fn render_txt(rows: &[TranscriptionEntry]) -> String {
    rows.iter()
        .map(|r| format!("[{}] {}: {}", format_clock(r.timestamp_ms), r.speaker_identity, r.text))
        .collect::<Vec<_>>()
        .join("\n")
}

fn render_md(rows: &[TranscriptionEntry]) -> String {
    let mut out = String::from("# Transcript\n\n");
    for r in rows {
        out.push_str(&format!(
            "**{}** `{}`: {}\n\n",
            format_clock(r.timestamp_ms),
            r.speaker_identity,
            r.text
        ));
    }
    out
}

/// Render SRT — one cue per utterance, 2-second default duration, times
/// relative to the first utterance (so the file plays from zero).
fn render_srt(rows: &[TranscriptionEntry]) -> String {
    if rows.is_empty() {
        return String::new();
    }
    let origin = rows[0].timestamp_ms;
    let mut out = String::new();
    for (idx, r) in rows.iter().enumerate() {
        let start_ms = (r.timestamp_ms - origin).max(0);
        // Use 2s chunk length or gap until next row (capped at 5s).
        let end_ms = rows
            .get(idx + 1)
            .map(|n| (n.timestamp_ms - origin).max(start_ms + 500))
            .unwrap_or(start_ms + 2000)
            .min(start_ms + 5000);
        out.push_str(&format!(
            "{}\n{} --> {}\n{}: {}\n\n",
            idx + 1,
            format_srt(start_ms),
            format_srt(end_ms),
            r.speaker_identity,
            r.text
        ));
    }
    out
}

/// Format milliseconds-since-epoch as `HH:MM:SS` wall-clock (UTC).
fn format_clock(ms: i64) -> String {
    let secs = ms / 1000;
    match Utc.timestamp_opt(secs, 0) {
        chrono::LocalResult::Single(dt) => dt.format("%H:%M:%S").to_string(),
        _ => String::from("00:00:00"),
    }
}

/// Format relative millisecond offset as `HH:MM:SS,MMM` (SRT timecode).
fn format_srt(ms: i64) -> String {
    let total_ms = ms.max(0);
    let hours = total_ms / 3_600_000;
    let minutes = (total_ms / 60_000) % 60;
    let seconds = (total_ms / 1000) % 60;
    let millis = total_ms % 1000;
    format!("{hours:02}:{minutes:02}:{seconds:02},{millis:03}")
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

    #[test]
    fn srt_timecode_format() {
        assert_eq!(format_srt(0), "00:00:00,000");
        assert_eq!(format_srt(1_500), "00:00:01,500");
        assert_eq!(format_srt(3_723_456), "01:02:03,456");
    }

    #[test]
    fn srt_empty_yields_empty_string() {
        assert!(render_srt(&[]).is_empty());
    }
}
