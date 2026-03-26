//! HTTP-based video understanding worker that calls a generic video analysis
//! service via REST endpoints.

use anyhow::{Context, Result};
use async_trait::async_trait;
use base64::Engine;
use bytes::Bytes;
use serde::Deserialize;
use std::time::Instant;
use tracing::debug;

use crate::gateway::{BackendType, Capability};
use crate::workers::{
    AiWorker, Frame, FrameExtractOpts, SceneDescription, TranscriptSegment, VideoAnalysis,
    VideoTranscript, VideoUnderstandWorker,
};

// ---------------------------------------------------------------------------
// HTTP response types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct AnalyzeResponse {
    summary: String,
    scenes: Vec<SceneResp>,
    model: Option<String>,
}

#[derive(Deserialize)]
struct SceneResp {
    start_secs: f32,
    end_secs: f32,
    description: String,
    confidence: Option<f32>,
}

#[derive(Deserialize)]
struct FrameResp {
    #[serde(default)]
    index: usize,
    timestamp: f32,
    image_base64: String,
    width: u32,
    height: u32,
}

#[derive(Deserialize)]
struct TranscriptResponse {
    segments: Vec<SegmentResp>,
    full_text: String,
    language: Option<String>,
}

#[derive(Deserialize)]
struct SegmentResp {
    start_secs: f32,
    end_secs: f32,
    text: String,
    confidence: Option<f32>,
}

// ---------------------------------------------------------------------------
// HttpVideoUnderstand
// ---------------------------------------------------------------------------

/// Video understanding worker that calls a generic video analysis HTTP
/// service for video analysis, frame extraction, and transcription.
pub struct HttpVideoUnderstand {
    client: reqwest::Client,
    base_url: String,
}

impl HttpVideoUnderstand {
    /// Create a new HTTP video understanding worker pointing at `base_url`
    /// (e.g. `http://localhost:9000`).
    pub fn new(base_url: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }
}

#[async_trait]
impl AiWorker for HttpVideoUnderstand {
    fn capability(&self) -> Capability {
        Capability::VideoUnderstand
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
        0.75
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
impl VideoUnderstandWorker for HttpVideoUnderstand {
    async fn analyze(&self, video: Bytes, prompt: Option<&str>) -> Result<VideoAnalysis> {
        let start = Instant::now();

        debug!(
            base_url = %self.base_url,
            video_size = video.len(),
            "HTTP video analyze request"
        );

        let mut form = reqwest::multipart::Form::new().part(
            "video",
            reqwest::multipart::Part::bytes(video.to_vec())
                .file_name("video.mp4")
                .mime_str("video/mp4")?,
        );

        if let Some(p) = prompt {
            form = form.text("prompt", p.to_string());
        }

        let resp = self
            .client
            .post(format!("{}/api/v1/video/analyze", self.base_url))
            .multipart(form)
            .send()
            .await
            .context("failed to send video analyze request")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("video analyze endpoint returned {status}: {error_body}");
        }

        let parsed: AnalyzeResponse = resp
            .json()
            .await
            .context("failed to parse video analyze response")?;

        let scenes = parsed
            .scenes
            .into_iter()
            .map(|s| SceneDescription {
                start_secs: s.start_secs,
                end_secs: s.end_secs,
                description: s.description,
                confidence: s.confidence.unwrap_or(0.75),
            })
            .collect();

        Ok(VideoAnalysis {
            summary: parsed.summary,
            scenes,
            model: parsed.model.unwrap_or_else(|| "http".to_string()),
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn extract_frames(&self, video: Bytes, opts: FrameExtractOpts) -> Result<Vec<Frame>> {
        debug!(
            base_url = %self.base_url,
            video_size = video.len(),
            "HTTP video extract_frames request"
        );

        let mut form = reqwest::multipart::Form::new().part(
            "video",
            reqwest::multipart::Part::bytes(video.to_vec())
                .file_name("video.mp4")
                .mime_str("video/mp4")?,
        );

        if let Some(max) = opts.max_frames {
            form = form.text("max_frames", max.to_string());
        }
        if let Some(interval) = opts.interval_secs {
            form = form.text("interval", interval.to_string());
        }
        if let Some(w) = opts.width {
            form = form.text("width", w.to_string());
        }
        if let Some(h) = opts.height {
            form = form.text("height", h.to_string());
        }

        let resp = self
            .client
            .post(format!("{}/api/v1/video/frames", self.base_url))
            .multipart(form)
            .send()
            .await
            .context("failed to send video frames request")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("video frames endpoint returned {status}: {error_body}");
        }

        let frame_resps: Vec<FrameResp> = resp
            .json()
            .await
            .context("failed to parse video frames response")?;

        let engine = base64::engine::general_purpose::STANDARD;
        let mut frames = Vec::with_capacity(frame_resps.len());
        for (idx, fr) in frame_resps.into_iter().enumerate() {
            let image_data = engine
                .decode(&fr.image_base64)
                .with_context(|| format!("failed to decode base64 for frame {}", idx))?;

            frames.push(Frame {
                timestamp_secs: fr.timestamp,
                image: Bytes::from(image_data),
                width: fr.width,
                height: fr.height,
            });
        }

        Ok(frames)
    }

    async fn transcribe_video(&self, video: Bytes) -> Result<VideoTranscript> {
        let start = Instant::now();

        debug!(
            base_url = %self.base_url,
            video_size = video.len(),
            "HTTP video transcribe request"
        );

        let form = reqwest::multipart::Form::new().part(
            "video",
            reqwest::multipart::Part::bytes(video.to_vec())
                .file_name("video.mp4")
                .mime_str("video/mp4")?,
        );

        let resp = self
            .client
            .post(format!("{}/api/v1/video/transcribe", self.base_url))
            .multipart(form)
            .send()
            .await
            .context("failed to send video transcribe request")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("video transcribe endpoint returned {status}: {error_body}");
        }

        let parsed: TranscriptResponse = resp
            .json()
            .await
            .context("failed to parse video transcribe response")?;

        let segments = parsed
            .segments
            .into_iter()
            .map(|s| TranscriptSegment {
                start_secs: s.start_secs,
                end_secs: s.end_secs,
                text: s.text,
                confidence: s.confidence.unwrap_or(0.75),
            })
            .collect();

        Ok(VideoTranscript {
            segments,
            full_text: parsed.full_text,
            language: parsed.language,
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }
}
