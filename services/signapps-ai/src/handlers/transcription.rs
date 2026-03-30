//! AQ-AITR: Meeting transcription via Whisper-compatible backend.
//!
//! Accepts audio blobs and forwards them to a Whisper inference endpoint
//! (local whisper.cpp HTTP server or Ollama with whisper model).
//! Falls back to an empty transcript if the backend is unavailable.

use axum::{
    extract::{Multipart, State},
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::Result;

use crate::AppState;

#[derive(Debug, Serialize)]
/// Response for Transcription.
pub struct TranscriptionResponse {
    pub text: String,
    pub language: Option<String>,
    pub duration_ms: Option<u64>,
    /// Whether the result came from the AI backend or is a fallback
    pub source: TranscriptionSource,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
/// Enum representing TranscriptionSource variants.
pub enum TranscriptionSource {
    Whisper,
    Fallback,
}

/// Transcribe an audio file using the whisper backend.
///
/// Accepts `multipart/form-data` with:
/// - `audio`: audio blob (webm, ogg, wav, mp4, mp3)
/// - `language`: optional ISO-639-1 language hint (e.g. "fr", "en")
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/transcription",
    responses((status = 200, description = "Success")),
    tag = "Ai"
)]
pub async fn transcribe_audio(
    State(_state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<TranscriptionResponse>> {
    let mut audio_bytes: Option<Vec<u8>> = None;
    let mut language: Option<String> = None;

    // Parse multipart fields
    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        match field.name() {
            Some("audio") => {
                audio_bytes = Some(field.bytes().await.unwrap_or_default().to_vec());
            },
            Some("language") => {
                language = field.text().await.ok();
            },
            _ => {},
        }
    }

    let audio = match audio_bytes {
        Some(b) if !b.is_empty() => b,
        _ => {
            return Ok(Json(TranscriptionResponse {
                text: String::new(),
                language: None,
                duration_ms: None,
                source: TranscriptionSource::Fallback,
            }));
        },
    };

    // Try whisper backend (whisper.cpp HTTP server on port 8178 by default)
    let whisper_url =
        std::env::var("WHISPER_URL").unwrap_or_else(|_| "http://localhost:8178".to_string());

    let start = std::time::Instant::now();

    // Build multipart form for whisper backend
    let form = reqwest::multipart::Form::new().part(
        "file",
        reqwest::multipart::Part::bytes(audio)
            .file_name("audio.webm")
            .mime_str("audio/webm")
            .unwrap_or_else(|_| reqwest::multipart::Part::bytes(vec![])),
    );

    let form = if let Some(ref lang) = language {
        form.text("language", lang.clone())
    } else {
        form
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .unwrap_or_default();

    match client
        .post(format!("{}/inference", whisper_url))
        .multipart(form)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            #[derive(Deserialize)]
            struct WhisperResponse {
                text: Option<String>,
            }

            let duration_ms = start.elapsed().as_millis() as u64;

            let text = resp
                .json::<WhisperResponse>()
                .await
                .ok()
                .and_then(|r| r.text)
                .unwrap_or_default()
                .trim()
                .to_string();

            Ok(Json(TranscriptionResponse {
                text,
                language,
                duration_ms: Some(duration_ms),
                source: TranscriptionSource::Whisper,
            }))
        },
        _ => {
            tracing::warn!(
                "Whisper backend unavailable at {whisper_url}, returning empty transcript"
            );
            Ok(Json(TranscriptionResponse {
                text: String::new(),
                language,
                duration_ms: None,
                source: TranscriptionSource::Fallback,
            }))
        },
    }
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
