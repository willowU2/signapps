//! Cloud-based video understanding worker that calls the Google Gemini API,
//! which natively supports video input for analysis and transcription.
#![allow(dead_code)]

use anyhow::{Context, Result};
use async_trait::async_trait;
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tracing::{debug, warn};

use crate::gateway::{BackendType, Capability};
use crate::workers::{
    AiWorker, Frame, FrameExtractOpts, SceneDescription, TranscriptSegment, VideoAnalysis,
    VideoTranscript, VideoUnderstandWorker,
};

// ---------------------------------------------------------------------------
// Gemini API constants
// ---------------------------------------------------------------------------

const GEMINI_UPLOAD_URL: &str = "https://generativelanguage.googleapis.com/upload/v1beta/files";

const GEMINI_API_BASE: &str = "https://generativelanguage.googleapis.com/v1beta";

// ---------------------------------------------------------------------------
// Gemini request / response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct GenerateContentRequest<'a> {
    contents: Vec<Content<'a>>,
}

#[derive(Serialize)]
struct Content<'a> {
    parts: Vec<Part<'a>>,
}

#[derive(Serialize)]
#[serde(untagged)]
enum Part<'a> {
    Text { text: &'a str },
    FileData { file_data: FileDataRef<'a> },
    InlineData { inline_data: InlineData },
}

#[derive(Serialize)]
struct FileDataRef<'a> {
    mime_type: &'a str,
    file_uri: &'a str,
}

#[derive(Serialize)]
struct InlineData {
    mime_type: String,
    data: String,
}

#[derive(Deserialize)]
struct GenerateContentResponse {
    candidates: Option<Vec<Candidate>>,
}

#[derive(Deserialize)]
struct Candidate {
    content: Option<CandidateContent>,
}

#[derive(Deserialize)]
struct CandidateContent {
    parts: Option<Vec<ResponsePart>>,
}

#[derive(Deserialize)]
struct ResponsePart {
    text: Option<String>,
}

#[derive(Deserialize)]
struct UploadResponse {
    file: Option<UploadedFile>,
}

#[derive(Deserialize)]
struct UploadedFile {
    name: Option<String>,
    uri: Option<String>,
    state: Option<String>,
}

#[derive(Deserialize)]
struct GetFileResponse {
    state: Option<String>,
    uri: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Extract the text content from a Gemini generateContent response.
fn extract_text(resp: &GenerateContentResponse) -> String {
    resp.candidates
        .as_ref()
        .and_then(|cs| cs.first())
        .and_then(|c| c.content.as_ref())
        .and_then(|content| content.parts.as_ref())
        .and_then(|parts| parts.first())
        .and_then(|p| p.text.clone())
        .unwrap_or_default()
}

// ---------------------------------------------------------------------------
// CloudVideoUnderstand
// ---------------------------------------------------------------------------

/// Video understanding worker that calls the Google Gemini API for video
/// analysis, scene extraction, and transcription. Gemini natively accepts
/// video input alongside text prompts.
pub struct CloudVideoUnderstand {
    client: reqwest::Client,
    api_key: String,
    model: String,
}

impl CloudVideoUnderstand {
    /// Create a new Google Gemini cloud video understanding worker.
    /// If `model` is `None`, defaults to `"gemini-1.5-pro"`.
    pub fn new(api_key: &str, model: Option<&str>) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: api_key.to_string(),
            model: model.unwrap_or("gemini-1.5-pro").to_string(),
        }
    }

    /// Upload a video to the Gemini Files API and return its file URI.
    async fn upload_video(&self, video: &Bytes) -> Result<String> {
        let form = reqwest::multipart::Form::new().part(
            "file",
            reqwest::multipart::Part::bytes(video.to_vec())
                .file_name("video.mp4")
                .mime_str("video/mp4")?,
        );

        let url = format!("{}?key={}", GEMINI_UPLOAD_URL, self.api_key);

        debug!(video_size = video.len(), "Gemini: uploading video");

        let resp = self
            .client
            .post(&url)
            .multipart(form)
            .send()
            .await
            .context("failed to upload video to Gemini Files API")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Gemini Files API upload returned {status}: {error_body}");
        }

        let upload: UploadResponse = resp
            .json()
            .await
            .context("failed to parse Gemini upload response")?;

        let file = upload
            .file
            .context("Gemini upload response missing file object")?;
        let file_name = file
            .name
            .context("Gemini upload response missing file name")?;
        let file_uri = file
            .uri
            .context("Gemini upload response missing file URI")?;

        // Wait for the file to become ACTIVE (processing may take a moment).
        self.wait_for_file_active(&file_name).await?;

        Ok(file_uri)
    }

    /// Poll the Gemini Files API until the uploaded file is ACTIVE.
    async fn wait_for_file_active(&self, file_name: &str) -> Result<()> {
        let url = format!(
            "{}/files/{}?key={}",
            GEMINI_API_BASE,
            file_name.strip_prefix("files/").unwrap_or(file_name),
            self.api_key,
        );

        for attempt in 0..30 {
            let resp = self
                .client
                .get(&url)
                .send()
                .await
                .context("failed to poll file status")?;

            if resp.status().is_success() {
                let file_info: GetFileResponse = resp
                    .json()
                    .await
                    .context("failed to parse file status response")?;

                match file_info.state.as_deref() {
                    Some("ACTIVE") => return Ok(()),
                    Some("FAILED") => {
                        anyhow::bail!("Gemini file processing failed");
                    },
                    _ => {
                        debug!(
                            attempt,
                            state = ?file_info.state,
                            "Gemini: file not yet active, waiting..."
                        );
                    },
                }
            } else {
                warn!(
                    attempt,
                    status = %resp.status(),
                    "Gemini: file status check failed"
                );
            }

            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }

        anyhow::bail!("Gemini file did not become ACTIVE within timeout")
    }

    /// Send a generateContent request to Gemini with a video file reference
    /// and a text prompt.
    async fn generate_with_video(&self, file_uri: &str, prompt: &str) -> Result<String> {
        let url = format!(
            "{}/models/{}:generateContent?key={}",
            GEMINI_API_BASE, self.model, self.api_key
        );

        let body = GenerateContentRequest {
            contents: vec![Content {
                parts: vec![
                    Part::FileData {
                        file_data: FileDataRef {
                            mime_type: "video/mp4",
                            file_uri,
                        },
                    },
                    Part::Text { text: prompt },
                ],
            }],
        };

        debug!(
            model = %self.model,
            prompt_len = prompt.len(),
            "Gemini video generateContent request"
        );

        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .context("failed to send generateContent request to Gemini")?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Gemini generateContent returned {status}: {error_body}");
        }

        let gen_resp: GenerateContentResponse = resp
            .json()
            .await
            .context("failed to parse Gemini generateContent response")?;

        Ok(extract_text(&gen_resp))
    }

    /// Parse a Gemini text response that describes video scenes into
    /// structured [`SceneDescription`] entries.
    fn parse_scenes(text: &str) -> Vec<SceneDescription> {
        // Gemini returns free-form text; we attempt to parse lines that
        // contain timestamps in a common "MM:SS - MM:SS: description"
        // or "N.N - N.N: description" format.
        let mut scenes = Vec::new();

        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // Try to parse "start - end: description" patterns.
            if let Some((times, desc)) = line.split_once(':') {
                if let Some((start_str, end_str)) = times.split_once('-') {
                    let start = Self::parse_timestamp(start_str.trim());
                    let end = Self::parse_timestamp(end_str.trim());
                    if let (Some(s), Some(e)) = (start, end) {
                        scenes.push(SceneDescription {
                            start_secs: s,
                            end_secs: e,
                            description: desc.trim().to_string(),
                            confidence: 0.90,
                        });
                        continue;
                    }
                }
            }

            // Fallback: treat the whole line as a scene description
            // without timestamps.
            if !line.is_empty() && scenes.is_empty() {
                scenes.push(SceneDescription {
                    start_secs: 0.0,
                    end_secs: 0.0,
                    description: line.to_string(),
                    confidence: 0.80,
                });
            }
        }

        scenes
    }

    /// Parse a timestamp string like "1:23", "01:23", or "83.5" into
    /// seconds.
    fn parse_timestamp(s: &str) -> Option<f32> {
        // Try MM:SS format first.
        if let Some((mm, ss)) = s.split_once(':') {
            let minutes: f32 = mm.trim().parse().ok()?;
            let seconds: f32 = ss.trim().parse().ok()?;
            return Some(minutes * 60.0 + seconds);
        }

        // Otherwise try plain seconds.
        s.trim().parse::<f32>().ok()
    }

    /// Parse a Gemini transcript response into
    /// [`TranscriptSegment`] entries.
    fn parse_transcript(text: &str) -> Vec<TranscriptSegment> {
        let mut segments = Vec::new();

        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // Try "[MM:SS - MM:SS] text" or "MM:SS - MM:SS: text" format.
            let cleaned = line.trim_start_matches('[').trim_start_matches('(');

            if let Some((times, rest)) = cleaned.split_once(']') {
                if let Some((start_str, end_str)) = times.split_once('-') {
                    let start = Self::parse_timestamp(start_str.trim());
                    let end = Self::parse_timestamp(end_str.trim());
                    if let (Some(s), Some(e)) = (start, end) {
                        segments.push(TranscriptSegment {
                            start_secs: s,
                            end_secs: e,
                            text: rest.trim().to_string(),
                            confidence: 0.85,
                        });
                        continue;
                    }
                }
            }

            // Try "MM:SS - MM:SS: text".
            if let Some((times, desc)) = cleaned.split_once(':') {
                if let Some((start_str, end_str)) = times.split_once('-') {
                    let start = Self::parse_timestamp(start_str.trim());
                    let end = Self::parse_timestamp(end_str.trim());
                    if let (Some(s), Some(e)) = (start, end) {
                        segments.push(TranscriptSegment {
                            start_secs: s,
                            end_secs: e,
                            text: desc.trim().to_string(),
                            confidence: 0.85,
                        });
                        continue;
                    }
                }
            }

            // Fallback: whole line without timestamps.
            if !line.is_empty() {
                let last_end = segments.last().map(|s| s.end_secs).unwrap_or(0.0);
                segments.push(TranscriptSegment {
                    start_secs: last_end,
                    end_secs: last_end,
                    text: line.to_string(),
                    confidence: 0.70,
                });
            }
        }

        segments
    }
}

#[async_trait]
impl AiWorker for CloudVideoUnderstand {
    fn capability(&self) -> Capability {
        Capability::VideoUnderstand
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Cloud {
            provider: "google".to_string(),
        }
    }

    fn required_vram_mb(&self) -> u64 {
        0
    }

    fn quality_score(&self) -> f32 {
        0.95
    }

    fn is_loaded(&self) -> bool {
        true
    }

    async fn health_check(&self) -> bool {
        // Cloud service is assumed to be always available.
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
impl VideoUnderstandWorker for CloudVideoUnderstand {
    async fn analyze(&self, video: Bytes, prompt: Option<&str>) -> Result<VideoAnalysis> {
        let start = Instant::now();

        // 1. Upload the video to Gemini Files API.
        let file_uri = self.upload_video(&video).await?;

        // 2. Generate analysis with the uploaded video.
        let default_prompt = "Analyze this video in detail. Provide:\n\
            1. A comprehensive summary of the video content.\n\
            2. A list of distinct scenes with timestamps \
            (start - end in seconds) and descriptions.\n\
            Format each scene as: START - END: description";

        let text = self
            .generate_with_video(&file_uri, prompt.unwrap_or(default_prompt))
            .await?;

        // 3. Parse the response into structured output.
        let scenes = Self::parse_scenes(&text);

        // Use the first paragraph as the summary, or the full text if
        // there is no clear scene section.
        let summary = text
            .split("\n\n")
            .next()
            .unwrap_or(&text)
            .trim()
            .to_string();

        Ok(VideoAnalysis {
            summary,
            scenes,
            model: self.model.clone(),
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn extract_frames(&self, video: Bytes, opts: FrameExtractOpts) -> Result<Vec<Frame>> {
        // Gemini does not expose raw frame extraction; instead we ask it to
        // describe key scenes with timestamps. Callers receive Frame structs
        // with empty image data but meaningful timestamps and dimensions.
        let file_uri = self.upload_video(&video).await?;

        let max_frames = opts.max_frames.unwrap_or(10);
        let prompt = format!(
            "Describe up to {max_frames} key visual moments/frames \
            in this video. For each frame, provide:\n\
            - Timestamp in seconds\n\
            - A detailed visual description\n\
            Format: TIMESTAMP: description"
        );

        let text = self.generate_with_video(&file_uri, &prompt).await?;

        let mut frames = Vec::new();
        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            if let Some((ts_str, _desc)) = line.split_once(':') {
                if let Some(ts) = Self::parse_timestamp(ts_str.trim()) {
                    frames.push(Frame {
                        timestamp_secs: ts,
                        // No actual image data from cloud-based extraction.
                        image: Bytes::new(),
                        width: opts.width.unwrap_or(0),
                        height: opts.height.unwrap_or(0),
                    });
                }
            }
        }

        // Respect max_frames limit.
        frames.truncate(max_frames as usize);

        Ok(frames)
    }

    async fn transcribe_video(&self, video: Bytes) -> Result<VideoTranscript> {
        let start = Instant::now();

        // Upload the video to Gemini Files API.
        let file_uri = self.upload_video(&video).await?;

        let prompt = "Transcribe all spoken audio in this video. \
            Format the output as timestamped segments:\n\
            [MM:SS - MM:SS] Spoken text here\n\
            After the segments, provide the detected language.";

        let text = self.generate_with_video(&file_uri, prompt).await?;

        let segments = Self::parse_transcript(&text);

        let full_text = segments
            .iter()
            .map(|s| s.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");

        // Try to detect language from the last line of the response.
        let language = text
            .lines()
            .rev()
            .find(|l| {
                let lower = l.to_lowercase();
                lower.contains("language") || lower.contains("detected")
            })
            .map(|l| {
                l.trim()
                    .trim_start_matches("Language:")
                    .trim_start_matches("Detected language:")
                    .trim()
                    .to_string()
            });

        Ok(VideoTranscript {
            segments,
            full_text,
            language,
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }
}
