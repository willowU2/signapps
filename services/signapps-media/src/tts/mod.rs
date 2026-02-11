//! TTS Module - Piper integration
//!
//! Piper is a fast, local neural text-to-speech system that sounds great.
//! Supports multiple voices and languages.

use bytes::Bytes;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Clone)]
pub struct TtsClient {
    client: Client,
    base_url: String,
    default_voice: String,
}

#[derive(Debug, Serialize)]
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
pub enum AudioFormat {
    #[default]
    Wav,
    Mp3,
    Ogg,
    Flac,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
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
pub enum VoiceQuality {
    Low,
    Medium,
    High,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct TtsResult {
    pub audio_data: Vec<u8>,
    pub format: AudioFormat,
    pub sample_rate: u32,
    pub duration_ms: u64,
    pub voice_used: String,
}

impl TtsClient {
    pub fn new(base_url: &str, default_voice: &str) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("Failed to build HTTP client");

        Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
            default_voice: default_voice.to_string(),
        }
    }

    /// Synthesize speech from text
    pub async fn synthesize(&self, request: TtsRequest) -> Result<TtsResult, TtsError> {
        // Coqui TTS API uses GET /api/tts?text=...
        // Don't send speaker_id for single-speaker models
        let url = format!("{}/api/tts?text={}",
            self.base_url,
            urlencoding::encode(&request.text)
        );

        let response = self.client
            .get(&url)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(TtsError::ServiceError(format!("TTS service error {}: {}", status, error_text)));
        }

        // Get audio data as bytes (WAV format)
        let audio_data = response.bytes().await?;

        Ok(TtsResult {
            audio_data: audio_data.to_vec(),
            format: AudioFormat::Wav,
            sample_rate: 22050,
            duration_ms: 0,
            voice_used: self.default_voice.clone(),
        })
    }

    /// Synthesize with streaming (for long texts)
    pub async fn synthesize_stream(&self, request: TtsRequest) -> Result<impl futures::Stream<Item = Result<Bytes, TtsError>>, TtsError> {
        let voice = request.voice.as_ref().unwrap_or(&self.default_voice);

        let payload = serde_json::json!({
            "text": request.text,
            "voice": voice,
            "speed": request.speed.unwrap_or(1.0),
            "pitch": request.pitch.unwrap_or(1.0),
            "stream": true
        });

        let response = self.client
            .post(format!("{}/synthesize/stream", self.base_url))
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(TtsError::ServiceError(format!("TTS service error {}: {}", status, error_text)));
        }

        Ok(futures::stream::unfold(response, |mut resp| async move {
            match resp.chunk().await {
                Ok(Some(chunk)) => Some((Ok(chunk), resp)),
                Ok(None) => None,
                Err(e) => Some((Err(TtsError::HttpError(e)), resp)),
            }
        }))
    }

    /// List available voices
    pub async fn list_voices(&self) -> Result<Vec<Voice>, TtsError> {
        let response = self.client
            .get(format!("{}/voices", self.base_url))
            .send()
            .await?;

        if !response.status().is_success() {
            // Return default voices if service unavailable
            return Ok(default_piper_voices());
        }

        let voices: Vec<Voice> = response.json().await?;
        Ok(voices)
    }

    /// Get voice info
    pub async fn get_voice(&self, voice_id: &str) -> Result<Voice, TtsError> {
        let response = self.client
            .get(format!("{}/voices/{}", self.base_url, voice_id))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(TtsError::VoiceNotFound(voice_id.to_string()));
        }

        let voice: Voice = response.json().await?;
        Ok(voice)
    }
}

fn default_piper_voices() -> Vec<Voice> {
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
pub enum TtsError {
    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("Service error: {0}")]
    ServiceError(String),

    #[error("Voice not found: {0}")]
    VoiceNotFound(String),

    #[error("Invalid text: {0}")]
    InvalidText(String),
}
