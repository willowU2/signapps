//! Audio generation HTTP endpoints.
//!
//! Provides music generation, sound-effect generation, and model listing.

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::workers::audiogen::{CloudAudioGen, HttpAudioGen};
use crate::workers::{AudioGenWorker, ModelInfo, MusicGenRequest, SfxGenRequest};
use crate::AppState;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/// Response for audio generation endpoints.
#[derive(Debug, Serialize)]
pub struct AudioGenResponse {
    pub audio_url: String,
    pub duration_seconds: f32,
    pub sample_rate: u32,
    pub model_used: String,
}

/// Response for listing available models.
#[derive(Debug, Serialize)]
pub struct AudioModelsResponse {
    pub models: Vec<ModelInfo>,
    pub count: usize,
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

/// JSON request body for the music generation endpoint.
#[derive(Debug, Deserialize)]
pub struct GenerateMusicRequest {
    pub prompt: String,
    pub duration_seconds: Option<f32>,
    pub temperature: Option<f32>,
    pub model: Option<String>,
}

/// JSON request body for the sound-effect generation endpoint.
#[derive(Debug, Deserialize)]
pub struct GenerateSfxRequest {
    pub prompt: String,
    pub duration_seconds: Option<f32>,
    pub model: Option<String>,
}

// ---------------------------------------------------------------------------
// Worker construction
// ---------------------------------------------------------------------------

/// Build an audio generation worker from environment variables.
///
/// Precedence:
/// 1. `AUDIOGEN_URL` + optional `AUDIOGEN_MODEL` -> [`HttpAudioGen`]
/// 2. `REPLICATE_API_KEY` -> [`CloudAudioGen`]
fn create_audiogen_worker() -> Result<Box<dyn AudioGenWorker + Send + Sync>, String> {
    if let Ok(url) = std::env::var("AUDIOGEN_URL") {
        let model = std::env::var("AUDIOGEN_MODEL").unwrap_or_else(|_| "default".into());
        Ok(Box::new(HttpAudioGen::new(&url, &model)))
    } else if let Ok(api_key) = std::env::var("REPLICATE_API_KEY") {
        Ok(Box::new(CloudAudioGen::new(&api_key, None)))
    } else {
        Err("No audio generation backend configured. \
             Set AUDIOGEN_URL or REPLICATE_API_KEY."
            .into())
    }
}

/// Map an anyhow worker error to an (StatusCode, String) tuple.
/// Errors that begin with MODEL_NOT_INSTALLED_PREFIX map to 501 Not Implemented;
/// all others map to 500 Internal Server Error.
fn map_worker_error(context: &str, e: anyhow::Error) -> (StatusCode, String) {
    let msg = e.to_string();
    if msg.contains("MODEL_NOT_INSTALLED:") {
        (StatusCode::NOT_IMPLEMENTED, format!("{}: {}", context, msg))
    } else {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("{}: {}", context, msg),
        )
    }
}

/// Store generated audio bytes in OpenDAL storage and return the path.
async fn store_audio(state: &AppState, audio_bytes: &[u8]) -> Result<String, (StatusCode, String)> {
    let path = format!("ai/generated/{}.wav", Uuid::new_v4());
    state
        .storage
        .write(&path, audio_bytes.to_vec())
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to store generated audio: {e}"),
            )
        })?;
    Ok(path)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// Generate music from a text prompt.
///
/// Accepts `application/json` with:
/// - `prompt` — text description of the music to generate (required)
/// - `duration_seconds` — audio duration (optional)
/// - `temperature` — generation temperature (optional)
/// - `model` — model name override (optional)
#[tracing::instrument(skip_all)]
pub async fn generate_music(
    State(state): State<AppState>,
    Json(body): Json<GenerateMusicRequest>,
) -> Result<Json<AudioGenResponse>, (StatusCode, String)> {
    if body.prompt.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Prompt must not be empty".to_string(),
        ));
    }

    let worker = create_audiogen_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let request = MusicGenRequest {
        prompt: body.prompt,
        duration_secs: body.duration_seconds,
        temperature: body.temperature,
        seed: None,
        model: body.model,
    };

    let result = worker
        .generate_music(request)
        .await
        .map_err(|e| map_worker_error("Music generation failed", e))?;

    let audio_url = store_audio(&state, &result.audio).await?;

    Ok(Json(AudioGenResponse {
        audio_url,
        duration_seconds: result.duration_secs,
        sample_rate: result.sample_rate,
        model_used: result.model,
    }))
}

/// Generate a sound effect from a text prompt.
///
/// Accepts `application/json` with:
/// - `prompt` — text description of the sound effect (required)
/// - `duration_seconds` — audio duration (optional)
/// - `model` — model name override (optional)
#[tracing::instrument(skip_all)]
pub async fn generate_sfx(
    State(state): State<AppState>,
    Json(body): Json<GenerateSfxRequest>,
) -> Result<Json<AudioGenResponse>, (StatusCode, String)> {
    if body.prompt.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Prompt must not be empty".to_string(),
        ));
    }

    let worker = create_audiogen_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let request = SfxGenRequest {
        prompt: body.prompt,
        duration_secs: body.duration_seconds,
        seed: None,
        model: body.model,
    };

    let result = worker
        .generate_sfx(request)
        .await
        .map_err(|e| map_worker_error("Sound effect generation failed", e))?;

    let audio_url = store_audio(&state, &result.audio).await?;

    Ok(Json(AudioGenResponse {
        audio_url,
        duration_seconds: result.duration_secs,
        sample_rate: result.sample_rate,
        model_used: result.model,
    }))
}

/// List available audio generation models.
#[tracing::instrument(skip_all)]
pub async fn list_models() -> Result<Json<AudioModelsResponse>, (StatusCode, String)> {
    let worker = create_audiogen_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let models = worker.list_models().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to list audio models: {e}"),
        )
    })?;

    let count = models.len();
    Ok(Json(AudioModelsResponse { models, count }))
}
