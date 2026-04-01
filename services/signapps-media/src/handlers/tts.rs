use axum::{
    body::Body,
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{
    tts::{AudioFormat, TtsRequest, Voice},
    AppState,
};

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for Synthesize.
pub struct SynthesizeRequest {
    pub text: String,
    pub voice: Option<String>,
    pub speed: Option<f32>,
    pub pitch: Option<f32>,
    pub format: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
/// Response for Synthesize.
pub struct SynthesizeResponse {
    pub success: bool,
    pub audio_base64: String,
    pub format: String,
    pub duration_ms: u64,
    pub voice_used: String,
}

/// Synthesize speech from text (returns raw audio bytes)
#[utoipa::path(
    post,
    path = "/api/v1/tts/synthesize",
    request_body = SynthesizeRequest,
    responses(
        (status = 200, description = "Audio data (audio/wav, audio/mpeg, audio/ogg, or audio/flac)"),
        (status = 400, description = "Invalid input or text too long"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "TTS synthesis failed"),
    ),
    security(("bearer" = [])),
    tag = "TTS"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn synthesize(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SynthesizeRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if request.text.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Text is required".to_string()));
    }

    if request.text.len() > 10000 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Text too long (max 10000 chars)".to_string(),
        ));
    }

    let format = match request.format.as_deref() {
        Some("mp3") => AudioFormat::Mp3,
        Some("ogg") => AudioFormat::Ogg,
        Some("flac") => AudioFormat::Flac,
        _ => AudioFormat::Wav,
    };

    let tts_request = TtsRequest {
        text: request.text,
        voice: request.voice,
        speed: request.speed,
        pitch: request.pitch,
        output_format: Some(format.clone()),
    };

    let result = state.tts.synthesize(tts_request).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("TTS failed: {}", e),
        )
    })?;

    let content_type = match format {
        AudioFormat::Wav => "audio/wav",
        AudioFormat::Mp3 => "audio/mpeg",
        AudioFormat::Ogg => "audio/ogg",
        AudioFormat::Flac => "audio/flac",
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header("X-Voice-Used", &result.voice_used)
        .header("X-Duration-Ms", result.duration_ms.to_string())
        .body(Body::from(result.audio_data))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

/// Synthesize speech with streaming (chunked audio/wav)
#[utoipa::path(
    post,
    path = "/api/v1/tts/stream",
    request_body = SynthesizeRequest,
    responses(
        (status = 200, description = "Chunked audio/wav stream"),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "TTS stream failed"),
    ),
    security(("bearer" = [])),
    tag = "TTS"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn synthesize_stream(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SynthesizeRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if request.text.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Text is required".to_string()));
    }

    let tts_request = TtsRequest {
        text: request.text,
        voice: request.voice,
        speed: request.speed,
        pitch: request.pitch,
        output_format: Some(AudioFormat::Wav),
    };

    let stream = state
        .tts
        .synthesize_stream(tts_request)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("TTS stream failed: {}", e),
            )
        })?;

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "audio/wav")
        .header(header::TRANSFER_ENCODING, "chunked")
        .body(Body::from_stream(stream))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

/// List available TTS voices
#[utoipa::path(
    get,
    path = "/api/v1/tts/voices",
    responses(
        (status = 200, description = "List of available voices"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Failed to list voices"),
    ),
    security(("bearer" = [])),
    tag = "TTS"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_voices(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Voice>>, (StatusCode, String)> {
    let voices = state.tts.list_voices().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to list voices: {}", e),
        )
    })?;

    Ok(Json(voices))
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
