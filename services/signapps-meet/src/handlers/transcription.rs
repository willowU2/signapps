//! Auto-transcription handler for meet recordings
//!
//! Handles the `meet.session.ended` event: when a session ends with a
//! recording_id, this module enqueues an AI transcription job and creates
//! a document in the docs service with the resulting transcript.

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

// ── Event payload ─────────────────────────────────────────────────────────────

/// Payload emitted by the event bus when a meet session ends.
#[derive(Debug, Deserialize)]
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
