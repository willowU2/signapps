//! Cloud-based video generation worker that calls the Replicate API for
//! video generation models (Runway, CogVideoX, minimax, etc.).

use anyhow::{Context, Result};
use async_trait::async_trait;
use base64::Engine;
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::gateway::{BackendType, Capability};
use crate::workers::{
    AiWorker, ImgToVideoRequest, ModelInfo, VideoGenRequest, VideoGenResult, VideoGenWorker,
};

// ---------------------------------------------------------------------------
// Replicate API constants
// ---------------------------------------------------------------------------

const REPLICATE_API_URL: &str = "https://api.replicate.com/v1/predictions";

/// Default model for video generation on Replicate.
const DEFAULT_MODEL: &str = "minimax/video-01";

/// Maximum number of polling attempts before giving up.
/// Video generation can be slow — allow up to 10 minutes.
const MAX_POLL_ATTEMPTS: u32 = 300;

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
// CloudVideoGen
// ---------------------------------------------------------------------------

/// Video generation worker that calls the Replicate API for models like
/// minimax/video-01, CogVideoX, Runway, etc.
pub struct CloudVideoGen {
    client: reqwest::Client,
    api_key: String,
    model: String,
}

impl CloudVideoGen {
    /// Create a new Replicate cloud video generation worker.
    /// If `model` is `None`, defaults to `"minimax/video-01"`.
    pub fn new(api_key: &str, model: Option<&str>) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: api_key.to_string(),
            model: model.unwrap_or(DEFAULT_MODEL).to_string(),
        }
    }

    /// Extract the version hash from a model string like
    /// `"minimax/video-01:abc123"`. Returns the part after the colon, or
    /// the full string if no colon is present.
    fn model_version(&self) -> &str {
        self.model
            .split_once(':')
            .map(|(_, v)| v)
            .unwrap_or(&self.model)
    }

    /// Submit a prediction to Replicate and poll until completion,
    /// then download the output video.
    async fn run_prediction(&self, input: serde_json::Value) -> Result<Bytes> {
        let body = ReplicatePredictionRequest {
            version: self.model_version(),
            input,
        };

        debug!(
            model = %self.model,
            "Replicate video generation request"
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

        // 3. Download the output video
        let video = self
            .client
            .get(&output_url)
            .send()
            .await
            .context("failed to download generated video from Replicate")?
            .bytes()
            .await
            .context("failed to read video bytes from Replicate output")?;

        Ok(video)
    }

    /// Poll the prediction URL until the status is `"succeeded"` or
    /// `"failed"`. Returns the output video URL on success.
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
                        "failed to poll Replicate prediction \
                         (attempt {attempt})"
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
                                "prediction output array is empty \
                                 or not a string",
                            )?
                            .to_string()
                    } else {
                        anyhow::bail!(
                            "unexpected Replicate output format: \
                             {output}"
                        );
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
impl AiWorker for CloudVideoGen {
    fn capability(&self) -> Capability {
        Capability::VideoGen
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
impl VideoGenWorker for CloudVideoGen {
    async fn text_to_video(&self, request: VideoGenRequest) -> Result<VideoGenResult> {
        let start = std::time::Instant::now();
        let duration_secs = request.duration_secs.unwrap_or(4.0);
        let fps = request.fps.unwrap_or(24);

        let mut input = serde_json::json!({
            "prompt": request.prompt,
            "duration": duration_secs,
            "fps": fps,
        });

        if let Some(w) = request.width {
            input["width"] = serde_json::json!(w);
        }
        if let Some(h) = request.height {
            input["height"] = serde_json::json!(h);
        }
        if let Some(ref neg) = request.negative_prompt {
            input["negative_prompt"] = serde_json::json!(neg);
        }
        if let Some(seed) = request.seed {
            input["seed"] = serde_json::json!(seed);
        }

        let video = self.run_prediction(input).await?;
        let duration_ms = start.elapsed().as_millis() as u64;
        let model = request.model.unwrap_or_else(|| self.model.clone());

        Ok(VideoGenResult {
            video,
            duration_secs,
            fps,
            model,
            duration_ms,
        })
    }

    async fn img_to_video(&self, request: ImgToVideoRequest) -> Result<VideoGenResult> {
        let start = std::time::Instant::now();
        let duration_secs = request.duration_secs.unwrap_or(4.0);
        let fps = request.fps.unwrap_or(24);

        // Encode the image as base64 data URI for Replicate
        let b64 = base64::engine::general_purpose::STANDARD.encode(&request.image);
        let data_uri = format!("data:image/png;base64,{b64}");

        let mut input = serde_json::json!({
            "image": data_uri,
            "duration": duration_secs,
            "fps": fps,
        });

        if let Some(ref prompt) = request.prompt {
            input["prompt"] = serde_json::json!(prompt);
        }
        if let Some(seed) = request.seed {
            input["seed"] = serde_json::json!(seed);
        }

        let video = self.run_prediction(input).await?;
        let duration_ms = start.elapsed().as_millis() as u64;
        let model = request.model.unwrap_or_else(|| self.model.clone());

        Ok(VideoGenResult {
            video,
            duration_secs,
            fps,
            model,
            duration_ms,
        })
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        // Static list — Replicate doesn't expose a model listing API
        // that would be useful here.
        Ok(vec![
            ModelInfo {
                id: "minimax-video-01".to_string(),
                name: "Minimax Video-01".to_string(),
                description: "Minimax video generation model \
                    for high-quality text-to-video and \
                    image-to-video synthesis"
                    .to_string(),
                vram_required_mb: 0,
                quality_score: 0.85,
            },
            ModelInfo {
                id: "cogvideox-5b".to_string(),
                name: "CogVideoX-5B".to_string(),
                description: "Tsinghua's CogVideoX 5B model \
                    for text-to-video generation"
                    .to_string(),
                vram_required_mb: 0,
                quality_score: 0.80,
            },
            ModelInfo {
                id: "wan-ai-wan2-1-t2v".to_string(),
                name: "Wan 2.1 Text-to-Video".to_string(),
                description: "Wan AI's text-to-video generation \
                    model with strong motion coherence"
                    .to_string(),
                vram_required_mb: 0,
                quality_score: 0.82,
            },
        ])
    }
}
