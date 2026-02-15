//! HTTP-based STT backend (Faster-Whisper Docker service).

use async_trait::async_trait;
use bytes::Bytes;
use futures::Stream;
use reqwest::Client;
use std::pin::Pin;
use std::time::Duration;

use super::*;

/// HTTP STT backend connecting to an external Whisper service.
pub struct HttpSttBackend {
    client: Client,
    base_url: String,
    default_model: String,
    default_language: Option<String>,
}

impl HttpSttBackend {
    pub fn new(base_url: &str, default_model: &str, default_language: Option<String>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(600))
            .build()
            .expect("Failed to build HTTP client");

        Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
            default_model: default_model.to_string(),
            default_language,
        }
    }
}

#[async_trait]
impl SttBackend for HttpSttBackend {
    async fn transcribe(
        &self,
        audio_data: Bytes,
        filename: &str,
        options: Option<TranscribeRequest>,
    ) -> Result<TranscribeResult, SttError> {
        let start = std::time::Instant::now();

        let mime_type = mime_guess::from_path(filename)
            .first_or_octet_stream()
            .to_string();

        let form = reqwest::multipart::Form::new().part(
            "audio_file",
            reqwest::multipart::Part::bytes(audio_data.to_vec())
                .file_name(filename.to_string())
                .mime_str(&mime_type)?,
        );

        let opts = options.unwrap_or_default();
        let task = match opts.task.unwrap_or_default() {
            TranscribeTask::Transcribe => "transcribe",
            TranscribeTask::Translate => "translate",
        };

        let mut url = format!("{}/asr?output=json&task={}", self.base_url, task);

        if let Some(lang) = opts.language.as_ref().or(self.default_language.as_ref()) {
            url.push_str(&format!("&language={}", lang));
        }

        if opts.word_timestamps.unwrap_or(false) {
            url.push_str("&word_timestamps=true");
        }

        let response = self.client.post(&url).multipart(form).send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(SttError::ServiceError(format!(
                "STT service error {}: {}",
                status, error_text
            )));
        }

        let processing_time = start.elapsed().as_millis() as u64;

        let whisper_response: serde_json::Value = response.json().await?;
        let text = whisper_response["text"].as_str().unwrap_or("").to_string();

        Ok(TranscribeResult {
            text: text.clone(),
            language: self
                .default_language
                .clone()
                .unwrap_or_else(|| "en".to_string()),
            language_probability: 0.95,
            duration_seconds: 0.0,
            segments: vec![Segment {
                id: 0,
                start: 0.0,
                end: 0.0,
                text,
                speaker: None,
                avg_logprob: 0.0,
                no_speech_prob: 0.0,
            }],
            words: None,
            speakers: None,
            model_used: self.default_model.clone(),
            processing_time_ms: processing_time,
        })
    }

    async fn transcribe_stream(
        &self,
        audio_data: Bytes,
        filename: &str,
        options: Option<TranscribeRequest>,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<TranscribeChunk, SttError>> + Send>>, SttError>
    {
        let mime_type = mime_guess::from_path(filename)
            .first_or_octet_stream()
            .to_string();

        let mut form = reqwest::multipart::Form::new().part(
            "file",
            reqwest::multipart::Part::bytes(audio_data.to_vec())
                .file_name(filename.to_string())
                .mime_str(&mime_type)?,
        );

        let opts = options.unwrap_or_default();
        let model = opts.model.as_ref().unwrap_or(&self.default_model);
        form = form.text("model", model.clone());
        form = form.text("stream", "true");

        if let Some(lang) = opts.language.as_ref().or(self.default_language.as_ref()) {
            form = form.text("language", lang.clone());
        }

        let response = self
            .client
            .post(format!("{}/transcribe/stream", self.base_url))
            .multipart(form)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(SttError::ServiceError(format!(
                "STT service error {}: {}",
                status, error_text
            )));
        }

        let stream = futures::stream::unfold(response, |mut resp| async move {
            match resp.chunk().await {
                Ok(Some(chunk)) => {
                    let text = String::from_utf8_lossy(&chunk);
                    if text.starts_with("data: ") {
                        let json_str = text.trim_start_matches("data: ").trim();
                        if json_str == "[DONE]" {
                            return None;
                        }
                        match serde_json::from_str::<TranscribeChunk>(json_str) {
                            Ok(chunk) => Some((Ok(chunk), resp)),
                            Err(e) => Some((Err(SttError::InvalidResponse(e.to_string())), resp)),
                        }
                    } else {
                        Some((
                            Err(SttError::InvalidResponse("Invalid SSE format".to_string())),
                            resp,
                        ))
                    }
                },
                Ok(None) => None,
                Err(e) => Some((Err(SttError::HttpError(e)), resp)),
            }
        });

        Ok(Box::pin(stream))
    }

    async fn list_models(&self) -> Result<Vec<SttModel>, SttError> {
        let response = self
            .client
            .get(format!("{}/models", self.base_url))
            .send()
            .await?;

        if !response.status().is_success() {
            return Ok(default_whisper_models());
        }

        let models: Vec<SttModel> = response.json().await?;
        Ok(models)
    }
}
