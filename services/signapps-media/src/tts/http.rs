//! HTTP-based TTS backend (Coqui TTS / Piper HTTP service).

use async_trait::async_trait;
use bytes::Bytes;
use futures::Stream;
use reqwest::Client;
use std::pin::Pin;
use std::time::Duration;

use super::*;

/// HTTP TTS backend connecting to an external TTS service.
pub struct HttpTtsBackend {
    client: Client,
    base_url: String,
    default_voice: String,
}

impl HttpTtsBackend {
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
}

#[async_trait]
impl TtsBackend for HttpTtsBackend {
    async fn synthesize(&self, request: TtsRequest) -> Result<TtsResult, TtsError> {
        let url = format!(
            "{}/api/tts?text={}",
            self.base_url,
            urlencoding::encode(&request.text)
        );

        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(TtsError::ServiceError(format!(
                "TTS service error {}: {}",
                status, error_text
            )));
        }

        let audio_data = response.bytes().await?;

        Ok(TtsResult {
            audio_data: audio_data.to_vec(),
            format: AudioFormat::Wav,
            sample_rate: 22050,
            duration_ms: 0,
            voice_used: self.default_voice.clone(),
        })
    }

    async fn synthesize_stream(
        &self,
        request: TtsRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<Bytes, TtsError>> + Send>>, TtsError> {
        let voice = request.voice.as_ref().unwrap_or(&self.default_voice);

        let payload = serde_json::json!({
            "text": request.text,
            "voice": voice,
            "speed": request.speed.unwrap_or(1.0),
            "pitch": request.pitch.unwrap_or(1.0),
            "stream": true
        });

        let response = self
            .client
            .post(format!("{}/synthesize/stream", self.base_url))
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(TtsError::ServiceError(format!(
                "TTS service error {}: {}",
                status, error_text
            )));
        }

        let stream = futures::stream::unfold(response, |mut resp| async move {
            match resp.chunk().await {
                Ok(Some(chunk)) => Some((Ok(chunk), resp)),
                Ok(None) => None,
                Err(e) => Some((Err(TtsError::HttpError(e)), resp)),
            }
        });

        Ok(Box::pin(stream))
    }

    async fn list_voices(&self) -> Result<Vec<Voice>, TtsError> {
        let response = self
            .client
            .get(format!("{}/voices", self.base_url))
            .send()
            .await?;

        if !response.status().is_success() {
            return Ok(default_piper_voices());
        }

        let voices: Vec<Voice> = response.json().await?;
        Ok(voices)
    }
}
