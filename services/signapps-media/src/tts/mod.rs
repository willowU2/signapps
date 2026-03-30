//! TTS Module - Text-to-Speech with pluggable backends.
//!
//! Supports:
//! - HTTP backend (Coqui TTS via Docker) when TTS_URL is set
//! - Native backend (piper-rs) when TTS_URL is empty

use async_trait::async_trait;
use bytes::Bytes;
use futures::Stream;
use serde::{Deserialize, Serialize};
use std::pin::Pin;

mod http;
#[cfg(feature = "native-tts")]
pub mod native;

pub use self::http::HttpTtsBackend;
#[cfg(feature = "native-tts")]
pub use self::native::NativeTtsBackend;

/// Stub backend that returns errors when no TTS backend is configured.
pub struct StubTtsBackend;

#[async_trait]
impl TtsBackend for StubTtsBackend {
    async fn synthesize(&self, _request: TtsRequest) -> Result<TtsResult, TtsError> {
        Err(TtsError::ServiceError(
            "TTS not configured. Set TTS_URL or enable native-tts feature.".to_string(),
        ))
    }

    async fn synthesize_stream(
        &self,
        _request: TtsRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<Bytes, TtsError>> + Send>>, TtsError> {
        Err(TtsError::ServiceError(
            "TTS not configured. Set TTS_URL or enable native-tts feature.".to_string(),
        ))
    }

    async fn list_voices(&self) -> Result<Vec<Voice>, TtsError> {
        Ok(vec![])
    }
}

/// Backend trait for TTS implementations.
#[async_trait]
pub trait TtsBackend: Send + Sync {
    /// Synthesize speech from text.
    async fn synthesize(&self, request: TtsRequest) -> Result<TtsResult, TtsError>;

    /// Synthesize with streaming audio chunks.
    async fn synthesize_stream(
        &self,
        request: TtsRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<Bytes, TtsError>> + Send>>, TtsError>;

    /// List available voices.
    async fn list_voices(&self) -> Result<Vec<Voice>, TtsError>;
}

#[derive(Debug, Serialize)]
/// Request payload for Tts operation.
pub struct TtsRequest {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pitch: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_format: Option<AudioFormat>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "lowercase")]
/// Enum representing AudioFormat variants.
pub enum AudioFormat {
    #[default]
    Wav,
    Mp3,
    Ogg,
    Flac,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
/// Represents a voice.
pub struct Voice {
    pub id: String,
    pub name: String,
    pub language: String,
    pub language_code: String,
    pub gender: Option<String>,
    pub quality: VoiceQuality,
    pub sample_rate: u32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "lowercase")]
/// Enum representing VoiceQuality variants.
pub enum VoiceQuality {
    Low,
    Medium,
    High,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
/// Represents a tts result.
pub struct TtsResult {
    pub audio_data: Vec<u8>,
    pub format: AudioFormat,
    pub sample_rate: u32,
    pub duration_ms: u64,
    pub voice_used: String,
}

pub fn default_piper_voices() -> Vec<Voice> {
    vec![
        Voice {
            id: "en_US-lessac-medium".to_string(),
            name: "Lessac".to_string(),
            language: "English (US)".to_string(),
            language_code: "en_US".to_string(),
            gender: Some("female".to_string()),
            quality: VoiceQuality::Medium,
            sample_rate: 22050,
        },
        Voice {
            id: "en_US-amy-medium".to_string(),
            name: "Amy".to_string(),
            language: "English (US)".to_string(),
            language_code: "en_US".to_string(),
            gender: Some("female".to_string()),
            quality: VoiceQuality::Medium,
            sample_rate: 22050,
        },
        Voice {
            id: "en_GB-alan-medium".to_string(),
            name: "Alan".to_string(),
            language: "English (UK)".to_string(),
            language_code: "en_GB".to_string(),
            gender: Some("male".to_string()),
            quality: VoiceQuality::Medium,
            sample_rate: 22050,
        },
        Voice {
            id: "fr_FR-siwis-medium".to_string(),
            name: "Siwis".to_string(),
            language: "French".to_string(),
            language_code: "fr_FR".to_string(),
            gender: Some("female".to_string()),
            quality: VoiceQuality::Medium,
            sample_rate: 22050,
        },
        Voice {
            id: "de_DE-thorsten-medium".to_string(),
            name: "Thorsten".to_string(),
            language: "German".to_string(),
            language_code: "de_DE".to_string(),
            gender: Some("male".to_string()),
            quality: VoiceQuality::Medium,
            sample_rate: 22050,
        },
    ]
}

#[derive(Debug, thiserror::Error)]
/// Error type for Tts operations.
pub enum TtsError {
    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("Service error: {0}")]
    ServiceError(String),

    #[error("Voice not found: {0}")]
    VoiceNotFound(String),

    #[error("Invalid text: {0}")]
    InvalidText(String),

    #[error("Model error: {0}")]
    ModelError(String),
}
