//! HTTP-based audio generation worker that calls a generic audio generation
//! service (e.g. MusicGen or Stable Audio server).

use anyhow::{Context, Result};
use async_trait::async_trait;
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::gateway::{BackendType, Capability};
use crate::workers::{
    AiWorker, AudioGenResult, AudioGenWorker, ModelInfo, MusicGenRequest, SfxGenRequest,
};

// ---------------------------------------------------------------------------
// Internal request / response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct AudioGenHttpRequest<'a> {
    prompt: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    duration: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    seed: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<&'a str>,
}

#[derive(Deserialize)]
struct HttpModelInfo {
    id: String,
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    vram_required_mb: u64,
    #[serde(default)]
    quality_score: f32,
}

// ---------------------------------------------------------------------------
// HttpAudioGen
// ---------------------------------------------------------------------------

/// Audio generation worker that calls a generic audio generation HTTP
/// service for music and sound-effect synthesis.
pub struct HttpAudioGen {
    client: reqwest::Client,
    base_url: String,
    default_model: String,
}

impl HttpAudioGen {
    /// Create a new HTTP audio generation worker pointing at `base_url`
    /// (e.g. `http://localhost:8080`).
    pub fn new(base_url: &str, default_model: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            default_model: default_model.to_string(),
        }
    }

    /// Common logic for posting an audio generation request to an endpoint
    /// and returning the raw audio bytes.
    async fn post_generate(
        &self,
        endpoint: &str,
        prompt: &str,
        duration: Option<f32>,
        temperature: Option<f32>,
        seed: Option<i64>,
        model: Option<&str>,
    ) -> Result<Bytes> {
        let body = AudioGenHttpRequest {
            prompt,
            duration,
            temperature,
            seed,
            model: Some(model.unwrap_or(&self.default_model)),
        };

        let url = format!("{}{}", self.base_url, endpoint);

        debug!(
            url = %url,
            model = model.unwrap_or(&self.default_model),
            "HTTP audio generation request"
        );

        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .with_context(|| format!("failed to send audio generation request to {url}"))?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!(
                "audio generation endpoint {url} returned {status}: \
                 {error_body}"
            );
        }

        resp.bytes()
            .await
            .context("failed to read audio bytes from response")
    }
}

#[async_trait]
impl AiWorker for HttpAudioGen {
    fn capability(&self) -> Capability {
        Capability::AudioGen
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Http {
            url: self.base_url.clone(),
        }
    }

    fn required_vram_mb(&self) -> u64 {
        0
    }

    fn quality_score(&self) -> f32 {
        0.80
    }

    fn is_loaded(&self) -> bool {
        true
    }

    async fn health_check(&self) -> bool {
        self.client
            .get(&self.base_url)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }

    async fn load(&self) -> Result<()> {
        Ok(())
    }

    async fn unload(&self) -> Result<()> {
        Ok(())
    }
}

#[async_trait]
impl AudioGenWorker for HttpAudioGen {
    async fn generate_music(&self, request: MusicGenRequest) -> Result<AudioGenResult> {
        let start = std::time::Instant::now();

        let audio = self
            .post_generate(
                "/api/v1/generate/music",
                &request.prompt,
                request.duration_secs,
                request.temperature,
                request.seed,
                request.model.as_deref(),
            )
            .await?;

        let duration_ms = start.elapsed().as_millis() as u64;
        let duration_secs = request.duration_secs.unwrap_or(10.0);
        let model = request.model.unwrap_or_else(|| self.default_model.clone());

        Ok(AudioGenResult {
            audio,
            duration_secs,
            sample_rate: 44100,
            model,
            duration_ms,
        })
    }

    async fn generate_sfx(&self, request: SfxGenRequest) -> Result<AudioGenResult> {
        let start = std::time::Instant::now();

        let audio = self
            .post_generate(
                "/api/v1/generate/sfx",
                &request.prompt,
                request.duration_secs,
                None, // SFX requests have no temperature
                request.seed,
                request.model.as_deref(),
            )
            .await?;

        let duration_ms = start.elapsed().as_millis() as u64;
        let duration_secs = request.duration_secs.unwrap_or(5.0);
        let model = request.model.unwrap_or_else(|| self.default_model.clone());

        Ok(AudioGenResult {
            audio,
            duration_secs,
            sample_rate: 44100,
            model,
            duration_ms,
        })
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        let url = format!("{}/api/v1/models", self.base_url);

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .context("failed to fetch models from audio generation service")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!(
                "audio generation models endpoint returned {status}: \
                 {error_body}"
            );
        }

        let models: Vec<HttpModelInfo> = resp
            .json()
            .await
            .context("failed to parse model list response")?;

        Ok(models
            .into_iter()
            .map(|m| ModelInfo {
                id: m.id,
                name: m.name,
                description: m.description,
                vram_required_mb: m.vram_required_mb,
                quality_score: m.quality_score,
            })
            .collect())
    }
}
