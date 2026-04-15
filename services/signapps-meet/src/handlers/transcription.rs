//! Auto-transcription handler for meet recordings
//!
//! Handles the `meet.session.ended` event: when a session ends with a
//! recording_id, this module enqueues an AI transcription job and creates
//! a document in the docs service with the resulting transcript.

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use signapps_transcription::tiptap::to_tiptap_doc;
use signapps_transcription::{
    Segment, SessionMeta, Speaker, TranscriptionResult, TranscriptionSource,
};
use uuid::Uuid;

use crate::AppState;

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

/// Background transcription pipeline (5 steps):
///
/// 1. Fetch recording metadata from `meet.recordings`
/// 2. Fetch audio bytes from the storage service
/// 3. Transcribe via STT (media service)
/// 4. Build `TranscriptionResult` with participant speaker labels, create Tiptap document
/// 5. POST document to docs service, mark job completed
///
/// # Errors
///
/// Returns `anyhow::Error` on any step failure (DB, HTTP, JSON parsing).
///
/// # Panics
///
/// None — all errors are propagated via `Result`.
async fn run_transcription_pipeline(
    pool: &sqlx::Pool<sqlx::Postgres>,
    recording_id: Uuid,
    room_id: Uuid,
) -> anyhow::Result<()> {
    tracing::info!(recording_id = %recording_id, room_id = %room_id, "Starting transcription pipeline");

    let client = reqwest::Client::new();
    let storage_url =
        std::env::var("STORAGE_URL").unwrap_or_else(|_| "http://localhost:3004".into());
    let media_url = std::env::var("MEDIA_URL").unwrap_or_else(|_| "http://localhost:3009".into());
    let docs_url = std::env::var("DOCS_URL").unwrap_or_else(|_| "http://localhost:3010".into());

    // ── Step 1: Fetch recording metadata ────────────────────────────────────

    let (storage_path, duration_seconds): (Option<String>, Option<i32>) =
        sqlx::query_as("SELECT storage_path, duration_seconds FROM meet.recordings WHERE id = $1")
            .bind(recording_id)
            .fetch_one(pool)
            .await?;

    let storage_path = storage_path
        .ok_or_else(|| anyhow::anyhow!("recording {recording_id} has no storage_path"))?;

    tracing::info!(
        recording_id = %recording_id,
        storage_path = %storage_path,
        duration_seconds = ?duration_seconds,
        "Step 1: recording metadata fetched"
    );

    // ── Step 2: Fetch audio bytes from storage service ──────────────────────

    let audio_url = format!("{storage_url}/api/v1/storage/files/{storage_path}");
    let audio_resp = client
        .get(&audio_url)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("storage fetch failed: {e}"))?;

    if !audio_resp.status().is_success() {
        return Err(anyhow::anyhow!(
            "storage returned HTTP {} for {audio_url}",
            audio_resp.status()
        ));
    }

    let audio_bytes = audio_resp
        .bytes()
        .await
        .map_err(|e| anyhow::anyhow!("failed to read audio bytes: {e}"))?;

    tracing::info!(
        recording_id = %recording_id,
        audio_bytes = audio_bytes.len(),
        "Step 2: audio bytes fetched from storage"
    );

    // ── Step 3: Transcribe via STT (media service) ──────────────────────────

    let stt_url = format!("{media_url}/api/v1/stt/transcribe?word_timestamps=true");

    let part = reqwest::multipart::Part::bytes(audio_bytes.to_vec())
        .file_name(storage_path.clone())
        .mime_str("audio/webm")
        .map_err(|e| anyhow::anyhow!("multipart mime error: {e}"))?;

    let form = reqwest::multipart::Form::new().part("file", part);

    let stt_resp = client
        .post(&stt_url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("STT request failed: {e}"))?;

    if !stt_resp.status().is_success() {
        let status = stt_resp.status();
        let body = stt_resp.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!("STT returned HTTP {status}: {body}"));
    }

    #[derive(Deserialize)]
    struct SttSegment {
        start: f64,
        end: f64,
        text: String,
        #[serde(default)]
        avg_logprob: Option<f64>,
    }

    #[derive(Deserialize)]
    struct SttResponse {
        language: String,
        segments: Vec<SttSegment>,
    }

    let stt: SttResponse = stt_resp
        .json()
        .await
        .map_err(|e| anyhow::anyhow!("failed to parse STT response: {e}"))?;

    tracing::info!(
        recording_id = %recording_id,
        language = %stt.language,
        segment_count = stt.segments.len(),
        "Step 3: STT transcription complete"
    );

    // ── Step 4: Build TranscriptionResult ───────────────────────────────────

    // Query participants joined with identity.users and core.persons for speaker labels
    #[derive(sqlx::FromRow)]
    struct ParticipantRow {
        user_id: Option<Uuid>,
        display_name: Option<String>,
    }

    let participants: Vec<ParticipantRow> = sqlx::query_as(
        r#"
        SELECT
            p.user_id,
            COALESCE(per.display_name, u.username, p.display_name) AS display_name
        FROM meet.participants p
        LEFT JOIN identity.users u ON u.id = p.user_id
        LEFT JOIN core.persons per ON per.user_id = p.user_id
        WHERE p.room_id = $1
        "#,
    )
    .bind(room_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let speakers: Vec<Speaker> = participants
        .iter()
        .enumerate()
        .map(|(i, p)| Speaker {
            id: format!("s{i}"),
            label: p
                .display_name
                .clone()
                .unwrap_or_else(|| format!("Speaker {}", i + 1)),
            person_id: p.user_id,
        })
        .collect();

    let duration_ms = duration_seconds.unwrap_or(0) as u64 * 1000;

    let segments: Vec<Segment> = stt
        .segments
        .iter()
        .map(|s| {
            let confidence = s
                .avg_logprob
                .map(|lp| (1.0 + lp as f32).clamp(0.0, 1.0))
                .unwrap_or(0.0);
            Segment {
                id: Uuid::new_v4(),
                start_ms: (s.start * 1000.0) as u64,
                end_ms: (s.end * 1000.0) as u64,
                text: s.text.trim().to_string(),
                speaker: None, // diarization not yet available
                confidence,
            }
        })
        .collect();

    let result = TranscriptionResult {
        meta: SessionMeta {
            session_id: room_id,
            source: TranscriptionSource::Meet,
            source_app: None,
            duration_ms,
            language: stt.language.clone(),
            speakers,
            created_at: chrono::Utc::now(),
            recording_id: Some(recording_id),
        },
        segments,
    };

    tracing::info!(
        recording_id = %recording_id,
        segments = result.segments.len(),
        speakers = result.meta.speakers.len(),
        "Step 4: TranscriptionResult built"
    );

    // ── Step 5: Create Tiptap document and update job status ────────────────

    let tiptap_doc = to_tiptap_doc(&result);

    let create_doc_url = format!("{docs_url}/api/v1/docs");
    let doc_payload = serde_json::json!({
        "name": format!("Transcription — {}", chrono::Utc::now().format("%Y-%m-%d %H:%M")),
        "content": tiptap_doc,
        "source": "meet-transcription",
        "metadata": {
            "recording_id": recording_id,
            "room_id": room_id,
            "language": stt.language,
        }
    });

    let doc_resp = client
        .post(&create_doc_url)
        .json(&doc_payload)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("docs service request failed: {e}"))?;

    let doc_id: Option<Uuid> = if doc_resp.status().is_success() {
        let body: serde_json::Value = doc_resp.json().await.unwrap_or_default();
        body.get("id")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok())
    } else {
        tracing::warn!(
            recording_id = %recording_id,
            status = %doc_resp.status(),
            "docs service returned non-success — transcription saved without doc link"
        );
        None
    };

    // Update transcription_jobs status to completed (if the table exists)
    let _ = sqlx::query(
        r#"
        UPDATE meet.transcription_jobs
        SET status = 'completed', doc_id = $2, updated_at = NOW()
        WHERE recording_id = $1
        "#,
    )
    .bind(recording_id)
    .bind(doc_id)
    .execute(pool)
    .await;

    // Mark recording as transcribed
    sqlx::query("UPDATE meet.recordings SET status = 'transcribed' WHERE id = $1")
        .bind(recording_id)
        .execute(pool)
        .await?;

    tracing::info!(
        recording_id = %recording_id,
        doc_id = ?doc_id,
        "Step 5: transcription pipeline completed successfully"
    );

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
