//! Cloud-based audio generation worker that calls the Replicate API for
//! MusicGen / Stable Audio models.

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
// Replicate API constants
// ---------------------------------------------------------------------------

const REPLICATE_API_URL: &str = "https://api.replicate.com/v1/predictions";

/// Default model for music generation on Replicate.
const DEFAULT_MODEL: &str = "meta/musicgen:large";

/// Maximum number of polling attempts before giving up.
const MAX_POLL_ATTEMPTS: u32 = 120;

/// Interval between polling attempts in milliseconds.
const POLL_INTERVAL_MS: u64 = 2000;

// ---------------------------------------------------------------------------
// Internal request / response types for Replicate API
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct ReplicatePredictionRequest<'a> {
    version: &'a str,
    input: serde_json::Value,
}

#[derive(Deserialize)]
struct ReplicatePredictionResponse {
    id: String,
    status: String,
    urls: Option<ReplicateUrls>,
    output: Option<serde_json::Value>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct ReplicateUrls {
    get: String,
}

// ---------------------------------------------------------------------------
// CloudAudioGen
// ---------------------------------------------------------------------------

/// Audio generation worker that calls the Replicate API for MusicGen and
/// Stable Audio models.
pub struct CloudAudioGen {
    client: reqwest::Client,
    api_key: String,
    model: String,
}

impl CloudAudioGen {
    /// Create a new Replicate cloud audio generation worker.
    /// If `model` is `None`, defaults to `"meta/musicgen:large"`.
    pub fn new(api_key: &str, model: Option<&str>) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: api_key.to_string(),
            model: model.unwrap_or(DEFAULT_MODEL).to_string(),
        }
    }

    /// Extract the version hash from a model string like
    /// `"meta/musicgen:abc123"`. Returns the part after the colon, or
    /// the full string if no colon is present.
    fn model_version(&self) -> &str {
        self.model
            .split_once(':')
            .map(|(_, v)| v)
            .unwrap_or(&self.model)
    }

    /// Submit a prediction to Replicate and poll until completion,
    /// then download the output audio.
    async fn run_prediction(&self, input: serde_json::Value) -> Result<Bytes> {
        let body = ReplicatePredictionRequest {
            version: self.model_version(),
            input,
        };

        debug!(
            model = %self.model,
            "Replicate audio generation request"
        );

        // 1. Create prediction
        let resp = self
            .client
            .post(REPLICATE_API_URL)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .context("failed to create Replicate prediction")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Replicate API returned {status}: {error_body}");
        }

        let prediction: ReplicatePredictionResponse = resp
            .json()
            .await
            .context("failed to parse Replicate prediction response")?;

        let poll_url = prediction
            .urls
            .as_ref()
            .map(|u| u.get.clone())
            .unwrap_or_else(|| format!("{}/{}", REPLICATE_API_URL, prediction.id));

        // 2. Poll for completion
        let output_url = self.poll_prediction(&poll_url).await?;

        // 3. Download the output audio
        let audio = self
            .client
            .get(&output_url)
            .send()
            .await
            .context("failed to download generated audio from Replicate")?
            .bytes()
            .await
            .context("failed to read audio bytes from Replicate output")?;

        Ok(audio)
    }

    /// Poll the prediction URL until the status is `"succeeded"` or
    /// `"failed"`. Returns the output audio URL on success.
    async fn poll_prediction(&self, url: &str) -> Result<String> {
        for attempt in 0..MAX_POLL_ATTEMPTS {
            tokio::time::sleep(std::time::Duration::from_millis(POLL_INTERVAL_MS)).await;

            let resp = self
                .client
                .get(url)
                .header("Authorization", format!("Bearer {}", self.api_key))
                .send()
                .await
                .with_context(|| {
                    format!(
                        "failed to poll Replicate prediction (attempt \
                         {attempt})"
                    )
                })?;

            let prediction: ReplicatePredictionResponse = resp
                .json()
                .await
                .context("failed to parse Replicate poll response")?;

            match prediction.status.as_str() {
                "succeeded" => {
                    // Output can be a string URL or an array of URLs.
                    let output = prediction
                        .output
                        .context("prediction succeeded but output is null")?;

                    let url = if let Some(s) = output.as_str() {
                        s.to_string()
                    } else if let Some(arr) = output.as_array() {
                        arr.first()
                            .and_then(|v| v.as_str())
                            .context(
                                "prediction output array is empty or not \
                                 a string",
                            )?
                            .to_string()
                    } else {
                        anyhow::bail!("unexpected Replicate output format: {output}");
                    };

                    return Ok(url);
                },
                "failed" | "canceled" => {
                    let error_msg = prediction
                        .error
                        .unwrap_or_else(|| "unknown error".to_string());
                    anyhow::bail!("Replicate prediction {}: {error_msg}", prediction.status);
                },
                other => {
                    debug!(
                        status = other,
                        attempt, "Replicate prediction still running"
                    );
                },
            }
        }

        anyhow::bail!(
            "Replicate prediction timed out after {} attempts",
            MAX_POLL_ATTEMPTS
        );
    }
}

#[async_trait]
impl AiWorker for CloudAudioGen {
    fn capability(&self) -> Capability {
        Capability::AudioGen
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Cloud {
            provider: "replicate".to_string(),
        }
    }

    fn required_vram_mb(&self) -> u64 {
        0
    }

    fn quality_score(&self) -> f32 {
        0.85
    }

    fn is_loaded(&self) -> bool {
        true
    }

    async fn health_check(&self) -> bool {
        // Cloud service is assumed to be always available; a lightweight
        // check would consume API credits.
        true
    }

    async fn load(&self) -> Result<()> {
        Ok(())
    }

    async fn unload(&self) -> Result<()> {
        Ok(())
    }
}

#[async_trait]
impl AudioGenWorker for CloudAudioGen {
    async fn generate_music(&self, request: MusicGenRequest) -> Result<AudioGenResult> {
        let start = std::time::Instant::now();
        let duration_secs = request.duration_secs.unwrap_or(10.0);

        let mut input = serde_json::json!({
            "prompt": request.prompt,
            "duration": duration_secs,
            "model_version": "melody-large",
        });

        if let Some(temp) = request.temperature {
            input["temperature"] = serde_json::json!(temp);
        }
        if let Some(seed) = request.seed {
            input["seed"] = serde_json::json!(seed);
        }

        let audio = self.run_prediction(input).await?;
        let duration_ms = start.elapsed().as_millis() as u64;
        let model = request.model.unwrap_or_else(|| self.model.clone());

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
        let duration_secs = request.duration_secs.unwrap_or(5.0);

        let mut input = serde_json::json!({
            "prompt": request.prompt,
            "duration": duration_secs,
        });

        if let Some(seed) = request.seed {
            input["seed"] = serde_json::json!(seed);
        }

        let audio = self.run_prediction(input).await?;
        let duration_ms = start.elapsed().as_millis() as u64;
        let model = request.model.unwrap_or_else(|| self.model.clone());

        Ok(AudioGenResult {
            audio,
            duration_secs,
            sample_rate: 44100,
            model,
            duration_ms,
        })
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        // Static list — Replicate doesn't expose a model listing API
        // that would be useful here.
        Ok(vec![
            ModelInfo {
                id: "musicgen-large".to_string(),
                name: "MusicGen Large".to_string(),
                description: "Meta's MusicGen large model for \
                    high-quality music generation from text prompts"
                    .to_string(),
                vram_required_mb: 0,
                quality_score: 0.85,
            },
            ModelInfo {
                id: "stable-audio-open".to_string(),
                name: "Stable Audio Open".to_string(),
                description: "Stability AI's open model for music \
                    and sound effect generation"
                    .to_string(),
                vram_required_mb: 0,
                quality_score: 0.80,
            },
        ])
    }
}
