//! Receives TranscriptionResult from CapturePipeline (Tauri) and creates the Tiptap document.

use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use std::sync::Arc;

use crate::AppState;

/// Ingest request payload from the Tauri CapturePipeline.
#[derive(Deserialize)]
pub struct IngestRequest {
    /// The transcription result produced by the pipeline.
    pub result: signapps_transcription::TranscriptionResult,
    /// Pre-built Tiptap JSON document.
    pub tiptap_doc: serde_json::Value,
}

/// POST /api/v1/stt/transcription-result
///
/// Receives a completed transcription from the CapturePipeline, forwards the
/// Tiptap document to `signapps-docs`, and records the job in `meet.transcription_jobs`.
///
/// # Errors
///
/// Returns `502 Bad Gateway` when the docs service is unreachable and
/// `500 Internal Server Error` on database failures.
#[tracing::instrument(skip(state, payload))]
pub async fn ingest_transcription_result(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<IngestRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let result = &payload.result;
    let title = format!(
        "Transcription — {}",
        result.meta.created_at.format("%Y-%m-%d %H:%M")
    );

    // Create document via docs service
    let docs_url = std::env::var("DOCS_URL").unwrap_or_else(|_| "http://localhost:3010".into());
    let client = reqwest::Client::new();
    let doc_resp = client
        .post(format!("{docs_url}/api/v1/docs"))
        .json(&serde_json::json!({
            "title": title,
            "content": payload.tiptap_doc,
            "type": "transcript",
        }))
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("docs service: {e}")))?
        .json::<serde_json::Value>()
        .await
        .unwrap_or_default();

    // Record transcription job
    sqlx::query::<sqlx::Postgres>(
        "INSERT INTO meet.transcription_jobs
         (source, status, source_app, language, duration_ms, document_id,
          speaker_count, segment_count, completed_at, tenant_id, capture_session_id)
         VALUES ($1, 'completed', $2, $3, $4, $5, $6, $7, NOW(), $8, $9)",
    )
    .bind(result.meta.source.to_string())
    .bind(&result.meta.source_app)
    .bind(&result.meta.language)
    .bind(result.meta.duration_ms as i64)
    .bind(
        doc_resp["id"]
            .as_str()
            .and_then(|s| uuid::Uuid::parse_str(s).ok()),
    )
    .bind(result.meta.speakers.len() as i32)
    .bind(result.segments.len() as i32)
    .bind(uuid::Uuid::nil()) // tenant_id — derived from auth in production
    .bind(result.meta.session_id)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db: {e}")))?;

    tracing::info!(
        segments = result.segments.len(),
        speakers = result.meta.speakers.len(),
        source = %result.meta.source,
        "transcription result ingested"
    );

    Ok(Json(serde_json::json!({
        "status": "ok",
        "document_id": doc_resp["id"],
    })))
}
