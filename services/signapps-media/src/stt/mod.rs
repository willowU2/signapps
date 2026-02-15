//! STT Module - Speech-to-Text with pluggable backends.
//!
//! Supports:
//! - HTTP backend (Faster-Whisper via Docker) when STT_URL is set
//! - Native backend (whisper-rs) when STT_URL is empty

use async_trait::async_trait;
use bytes::Bytes;
use futures::Stream;
use serde::{Deserialize, Serialize};
use std::pin::Pin;

mod http;
#[cfg(feature = "native-stt")]
pub mod native;

pub use self::http::HttpSttBackend;
#[cfg(feature = "native-stt")]
pub use self::native::NativeSttBackend;

/// Stub backend that returns errors when no STT backend is configured.
pub struct StubSttBackend;

#[async_trait]
impl SttBackend for StubSttBackend {
    async fn transcribe(
        &self,
        _audio: Bytes,
        _filename: &str,
        _opts: Option<TranscribeRequest>,
    ) -> Result<TranscribeResult, SttError> {
        Err(SttError::ServiceError(
            "STT not configured. Set STT_URL or enable native-stt feature.".to_string(),
        ))
    }

    async fn transcribe_stream(
        &self,
        _audio: Bytes,
        _filename: &str,
        _opts: Option<TranscribeRequest>,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<TranscribeChunk, SttError>> + Send>>, SttError>
    {
        Err(SttError::ServiceError(
            "STT not configured. Set STT_URL or enable native-stt feature.".to_string(),
        ))
    }

    async fn list_models(&self) -> Result<Vec<SttModel>, SttError> {
        Ok(vec![])
    }
}

/// Backend trait for STT implementations.
#[async_trait]
pub trait SttBackend: Send + Sync {
    /// Transcribe a complete audio file.
    async fn transcribe(
        &self,
        audio: Bytes,
        filename: &str,
        opts: Option<TranscribeRequest>,
    ) -> Result<TranscribeResult, SttError>;

    /// Transcribe with streaming segment results.
    async fn transcribe_stream(
        &self,
        audio: Bytes,
        filename: &str,
        opts: Option<TranscribeRequest>,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<TranscribeChunk, SttError>> + Send>>, SttError>;

    /// List available models.
    async fn list_models(&self) -> Result<Vec<SttModel>, SttError>;
}

#[derive(Debug, Serialize)]
pub struct TranscribeRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task: Option<TranscribeTask>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub word_timestamps: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diarize: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initial_prompt: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "lowercase")]
pub enum TranscribeTask {
    #[default]
    Transcribe,
    Translate,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct TranscribeResult {
    pub text: String,
    pub language: String,
    pub language_probability: f32,
    pub duration_seconds: f32,
    pub segments: Vec<Segment>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub words: Option<Vec<Word>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speakers: Option<Vec<Speaker>>,
    pub model_used: String,
    pub processing_time_ms: u64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Segment {
    pub id: u32,
    pub start: f32,
    pub end: f32,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speaker: Option<String>,
    pub avg_logprob: f32,
    pub no_speech_prob: f32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Word {
    pub word: String,
    pub start: f32,
    pub end: f32,
    pub probability: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speaker: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Speaker {
    pub id: String,
    pub label: String,
    pub speaking_time: f32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SttModel {
    pub id: String,
    pub name: String,
    pub size: String,
    pub languages: Vec<String>,
    pub multilingual: bool,
    pub description: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct TranscribeChunk {
    pub segment_id: u32,
    pub text: String,
    pub start: f32,
    pub end: f32,
    pub is_final: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[allow(dead_code)]
pub struct LanguageDetection {
    pub detected_language: String,
    pub language_probability: f32,
    pub all_languages: Vec<LanguageProbability>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[allow(dead_code)]
pub struct LanguageProbability {
    pub language: String,
    pub probability: f32,
}

impl Default for TranscribeRequest {
    fn default() -> Self {
        Self {
            language: None,
            model: None,
            task: Some(TranscribeTask::Transcribe),
            word_timestamps: None,
            diarize: None,
            initial_prompt: None,
        }
    }
}

pub fn default_whisper_models() -> Vec<SttModel> {
    vec![
        SttModel {
            id: "tiny".to_string(),
            name: "Tiny".to_string(),
            size: "39M".to_string(),
            languages: vec!["en".to_string()],
            multilingual: false,
            description: "Fastest, lowest accuracy".to_string(),
        },
        SttModel {
            id: "base".to_string(),
            name: "Base".to_string(),
            size: "74M".to_string(),
            languages: vec!["en".to_string()],
            multilingual: false,
            description: "Good balance for English".to_string(),
        },
        SttModel {
            id: "small".to_string(),
            name: "Small".to_string(),
            size: "244M".to_string(),
            languages: vec!["multilingual".to_string()],
            multilingual: true,
            description: "Good multilingual performance".to_string(),
        },
        SttModel {
            id: "medium".to_string(),
            name: "Medium".to_string(),
            size: "769M".to_string(),
            languages: vec!["multilingual".to_string()],
            multilingual: true,
            description: "Better accuracy, slower".to_string(),
        },
        SttModel {
            id: "large-v3".to_string(),
            name: "Large V3".to_string(),
            size: "1.5G".to_string(),
            languages: vec!["multilingual".to_string()],
            multilingual: true,
            description: "Best accuracy, requires GPU".to_string(),
        },
    ]
}

#[derive(Debug, thiserror::Error)]
pub enum SttError {
    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("Service error: {0}")]
    ServiceError(String),

    #[error("Invalid response: {0}")]
    InvalidResponse(String),

    #[error("Audio format not supported: {0}")]
    UnsupportedFormat(String),

    #[error("Model error: {0}")]
    ModelError(String),
}
