use axum::{
    extract::{Multipart, Query, State},
    http::StatusCode,
    response::{sse::Event, Sse},
    Json,
};
use futures::stream::Stream;
use serde::{Deserialize, Serialize};
use std::{convert::Infallible, sync::Arc, time::Duration};

use crate::{
    stt::{SttModel, TranscribeRequest, TranscribeTask},
    AppState,
};

#[derive(Debug, Deserialize, utoipa::IntoParams)]
/// Query parameters for filtering results.
pub struct TranscribeParams {
    pub language: Option<String>,
    pub model: Option<String>,
    pub task: Option<String>,
    pub word_timestamps: Option<bool>,
    pub diarize: Option<bool>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for Transcribe.
pub struct TranscribeResponse {
    pub success: bool,
    pub text: String,
    pub language: String,
    pub language_probability: f32,
    pub duration_seconds: f32,
    pub segments: Vec<SegmentResponse>,
    pub words: Option<Vec<WordResponse>>,
    pub speakers: Option<Vec<SpeakerResponse>>,
    pub model_used: String,
    pub processing_time_ms: u64,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for Segment.
pub struct SegmentResponse {
    pub id: u32,
    pub start: f32,
    pub end: f32,
    pub text: String,
    pub speaker: Option<String>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for Word.
pub struct WordResponse {
    pub word: String,
    pub start: f32,
    pub end: f32,
    pub probability: f32,
    pub speaker: Option<String>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for Speaker.
pub struct SpeakerResponse {
    pub id: String,
    pub label: String,
    pub speaking_time: f32,
}

/// Transcribe audio file
#[utoipa::path(
    post,
    path = "/api/v1/stt/transcribe",
    params(TranscribeParams),
    request_body(content_type = "multipart/form-data", description = "Audio file (max 100 MB)"),
    responses(
        (status = 200, description = "Transcription completed", body = TranscribeResponse),
        (status = 400, description = "Invalid input or file too large"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Transcription failed"),
    ),
    security(("bearer" = [])),
    tag = "STT"
)]
#[tracing::instrument(skip_all)]
pub async fn transcribe(
    State(state): State<Arc<AppState>>,
    Query(params): Query<TranscribeParams>,
    mut multipart: Multipart,
) -> Result<Json<TranscribeResponse>, (StatusCode, String)> {
    let field = multipart
        .next_field()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                format!("Failed to read multipart: {}", e),
            )
        })?
        .ok_or((StatusCode::BAD_REQUEST, "No file provided".to_string()))?;

    let filename = field.file_name().unwrap_or("audio").to_string();
    let data = field.bytes().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to read file: {}", e),
        )
    })?;

    if data.len() > 100 * 1024 * 1024 {
        return Err((
            StatusCode::BAD_REQUEST,
            "File too large (max 100MB)".to_string(),
        ));
    }

    let task = match params.task.as_deref() {
        Some("translate") => Some(TranscribeTask::Translate),
        _ => Some(TranscribeTask::Transcribe),
    };

    let options = TranscribeRequest {
        language: params.language,
        model: params.model,
        task,
        word_timestamps: params.word_timestamps,
        diarize: params.diarize,
        initial_prompt: None,
    };

    let result = state
        .stt
        .transcribe(data, &filename, Some(options))
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Transcription failed: {}", e),
            )
        })?;

    Ok(Json(TranscribeResponse {
        success: true,
        text: result.text,
        language: result.language,
        language_probability: result.language_probability,
        duration_seconds: result.duration_seconds,
        segments: result
            .segments
            .into_iter()
            .map(|s| SegmentResponse {
                id: s.id,
                start: s.start,
                end: s.end,
                text: s.text,
                speaker: s.speaker,
            })
            .collect(),
        words: result.words.map(|words| {
            words
                .into_iter()
                .map(|w| WordResponse {
                    word: w.word,
                    start: w.start,
                    end: w.end,
                    probability: w.probability,
                    speaker: w.speaker,
                })
                .collect()
        }),
        speakers: result.speakers.map(|speakers| {
            speakers
                .into_iter()
                .map(|s| SpeakerResponse {
                    id: s.id,
                    label: s.label,
                    speaking_time: s.speaking_time,
                })
                .collect()
        }),
        model_used: result.model_used,
        processing_time_ms: result.processing_time_ms,
    }))
}

/// Transcribe with streaming results (Server-Sent Events)
#[utoipa::path(
    post,
    path = "/api/v1/stt/transcribe/stream",
    params(TranscribeParams),
    request_body(content_type = "multipart/form-data", description = "Audio file"),
    responses(
        (status = 200, description = "SSE stream of transcription chunks (text/event-stream)"),
        (status = 400, description = "Invalid input or missing file"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Stream failed"),
    ),
    security(("bearer" = [])),
    tag = "STT"
)]
#[tracing::instrument(skip_all)]
pub async fn transcribe_stream(
    State(state): State<Arc<AppState>>,
    Query(params): Query<TranscribeParams>,
    mut multipart: Multipart,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, (StatusCode, String)> {
    let field = multipart
        .next_field()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                format!("Failed to read multipart: {}", e),
            )
        })?
        .ok_or((StatusCode::BAD_REQUEST, "No file provided".to_string()))?;

    let filename = field.file_name().unwrap_or("audio").to_string();
    let data = field.bytes().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to read file: {}", e),
        )
    })?;

    let options = TranscribeRequest {
        language: params.language,
        model: params.model,
        task: None,
        word_timestamps: params.word_timestamps,
        diarize: params.diarize,
        initial_prompt: None,
    };

    let stream = state
        .stt
        .transcribe_stream(data, &filename, Some(options))
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Stream failed: {}", e),
            )
        })?;

    let sse_stream = futures::stream::unfold(stream, |mut s| async move {
        use futures::StreamExt;
        match s.as_mut().next().await {
            Some(Ok(chunk)) => {
                let event = Event::default()
                    .json_data(serde_json::json!({
                        "segment_id": chunk.segment_id,
                        "text": chunk.text,
                        "start": chunk.start,
                        "end": chunk.end,
                        "is_final": chunk.is_final
                    }))
                    .expect("STT chunk serialization is infallible");
                Some((Ok(event), s))
            },
            Some(Err(e)) => {
                let event = Event::default()
                    .json_data(serde_json::json!({
                        "error": e.to_string()
                    }))
                    .expect("error event serialization is infallible");
                Some((Ok(event), s))
            },
            None => None,
        }
    });

    Ok(Sse::new(sse_stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(10))
            .text("keep-alive"),
    ))
}

/// List available STT models
#[utoipa::path(
    get,
    path = "/api/v1/stt/models",
    responses(
        (status = 200, description = "List of available STT models"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Failed to list models"),
    ),
    security(("bearer" = [])),
    tag = "STT"
)]
#[tracing::instrument(skip_all)]
pub async fn list_models(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<SttModel>>, (StatusCode, String)> {
    let models = state.stt.list_models().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to list models: {}", e),
        )
    })?;

    Ok(Json(models))
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
