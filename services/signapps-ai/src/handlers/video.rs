//! Video generation and understanding HTTP endpoints.
//!
//! Provides text-to-video, image-to-video generation, video analysis,
//! frame extraction, video transcription, and model listing.

use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::workers::video_understand::{CloudVideoUnderstand, HttpVideoUnderstand};
use crate::workers::videogen::{CloudVideoGen, HttpVideoGen};
use crate::workers::{
    FrameExtractOpts, ImgToVideoRequest, ModelInfo, VideoAnalysis, VideoGenRequest, VideoGenWorker,
    VideoTranscript, VideoUnderstandWorker,
};
use crate::AppState;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/// Response for video generation endpoints.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for VideoGen.
pub struct VideoGenResponse {
    pub video_url: String,
    pub duration_seconds: f32,
    pub fps: u32,
    pub model_used: String,
}

/// Response for frame extraction.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// FrameInfo data transfer object.
pub struct FrameInfo {
    pub index: usize,
    pub timestamp_seconds: f32,
    pub width: u32,
    pub height: u32,
}

/// Response for the extract-frames endpoint.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for ExtractFrames.
pub struct ExtractFramesResponse {
    pub frames: Vec<FrameInfo>,
    pub count: usize,
}

/// Response for listing available models.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for VideoModels.
pub struct VideoModelsResponse {
    /// Available video generation models.
    #[schema(value_type = Vec<serde_json::Value>)]
    pub models: Vec<ModelInfo>,
    /// Number of available models.
    pub count: usize,
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

/// JSON request body for the text-to-video endpoint.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for GenerateVideo.
pub struct GenerateVideoRequest {
    pub prompt: String,
    pub duration_seconds: Option<f32>,
    pub fps: Option<u32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub model: Option<String>,
}

// ---------------------------------------------------------------------------
// Worker construction
// ---------------------------------------------------------------------------

/// Build a video generation worker from environment variables.
///
/// Precedence:
/// 1. `VIDEOGEN_URL` + optional `VIDEOGEN_MODEL` -> [`HttpVideoGen`]
/// 2. `REPLICATE_API_KEY` -> [`CloudVideoGen`]
fn create_videogen_worker() -> Result<Box<dyn VideoGenWorker + Send + Sync>, String> {
    if let Ok(url) = std::env::var("VIDEOGEN_URL") {
        let model = std::env::var("VIDEOGEN_MODEL").unwrap_or_else(|_| "default".into());
        Ok(Box::new(HttpVideoGen::new(&url, &model)))
    } else if let Ok(api_key) = std::env::var("REPLICATE_API_KEY") {
        Ok(Box::new(CloudVideoGen::new(&api_key, None)))
    } else {
        Err("No video generation backend configured. \
             Set VIDEOGEN_URL or REPLICATE_API_KEY."
            .into())
    }
}

/// Build a video understanding worker from environment variables.
///
/// Precedence:
/// 1. `VIDEO_UNDERSTAND_URL` -> [`HttpVideoUnderstand`]
/// 2. `GEMINI_API_KEY` -> [`CloudVideoUnderstand`]
fn create_video_understand_worker() -> Result<Box<dyn VideoUnderstandWorker + Send + Sync>, String>
{
    if let Ok(url) = std::env::var("VIDEO_UNDERSTAND_URL") {
        Ok(Box::new(HttpVideoUnderstand::new(&url)))
    } else if let Ok(api_key) = std::env::var("GEMINI_API_KEY") {
        Ok(Box::new(CloudVideoUnderstand::new(&api_key, None)))
    } else {
        Err("No video understanding backend configured. \
             Set VIDEO_UNDERSTAND_URL or GEMINI_API_KEY."
            .into())
    }
}

/// Map an anyhow worker error to an (StatusCode, String) tuple.
/// Errors with MODEL_NOT_INSTALLED_PREFIX map to 501; others to 500.
fn map_worker_error(context: &str, e: anyhow::Error) -> (StatusCode, String) {
    let msg = e.to_string();
    if msg.contains("MODEL_NOT_INSTALLED:") {
        (StatusCode::NOT_IMPLEMENTED, format!("{}: {}", context, msg))
    } else {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("{}: {}", context, msg),
        )
    }
}

/// Store generated video bytes in OpenDAL storage and return the path.
async fn store_video(state: &AppState, video_bytes: &[u8]) -> Result<String, (StatusCode, String)> {
    let path = format!("ai/generated/{}.mp4", Uuid::new_v4());
    state
        .storage
        .write(&path, video_bytes.to_vec())
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to store generated video: {e}"),
            )
        })?;
    Ok(path)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// Generate a video from a text prompt.
///
/// Accepts `application/json` with:
/// - `prompt` — text description of the video to generate (required)
/// - `duration_seconds` — video duration (optional)
/// - `fps` — frames per second (optional)
/// - `width` / `height` — video dimensions (optional)
/// - `model` — model name override (optional)
#[utoipa::path(
    post,
    path = "/api/v1/ai/video/generate",
    request_body = GenerateVideoRequest,
    responses(
        (status = 200, description = "Generated video URL and metadata", body = VideoGenResponse),
        (status = 400, description = "Empty prompt"),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "No video generation backend configured"),
    ),
    security(("bearerAuth" = [])),
    tag = "video"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn generate_video(
    State(state): State<AppState>,
    Json(body): Json<GenerateVideoRequest>,
) -> Result<Json<VideoGenResponse>, (StatusCode, String)> {
    if body.prompt.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Prompt must not be empty".to_string(),
        ));
    }

    let worker = create_videogen_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let request = VideoGenRequest {
        prompt: body.prompt,
        negative_prompt: None,
        width: body.width,
        height: body.height,
        duration_secs: body.duration_seconds,
        fps: body.fps,
        seed: None,
        model: body.model,
    };

    let result = worker
        .text_to_video(request)
        .await
        .map_err(|e| map_worker_error("Video generation failed", e))?;

    let video_url = store_video(&state, &result.video).await?;

    Ok(Json(VideoGenResponse {
        video_url,
        duration_seconds: result.duration_secs,
        fps: result.fps,
        model_used: result.model,
    }))
}

/// Generate a video from an input image.
///
/// Accepts `multipart/form-data` with:
/// - `image` — the source image file (required)
/// - `prompt` — optional text guidance
/// - `duration_seconds` — video duration (optional)
/// - `model` — model name override (optional)
#[utoipa::path(
    post,
    path = "/api/v1/ai/video/img2video",
    request_body(
        content_type = "multipart/form-data",
        description = "Source image and optional guidance",
        content = String,
    ),
    responses(
        (status = 200, description = "Generated video URL and metadata", body = VideoGenResponse),
        (status = 400, description = "Missing or empty image"),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "No video generation backend configured"),
    ),
    security(("bearerAuth" = [])),
    tag = "video"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn img_to_video(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<VideoGenResponse>, (StatusCode, String)> {
    let mut image_bytes: Option<Vec<u8>> = None;
    let mut prompt: Option<String> = None;
    let mut duration_seconds: Option<f32> = None;
    let mut model: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to read multipart field: {e}"),
        )
    })? {
        match field.name() {
            Some("image") => {
                image_bytes = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| {
                            (
                                StatusCode::BAD_REQUEST,
                                format!("Failed to read image bytes: {e}"),
                            )
                        })?
                        .to_vec(),
                );
            },
            Some("prompt") => {
                prompt = field.text().await.ok();
            },
            Some("duration_seconds") => {
                if let Ok(text) = field.text().await {
                    if let Ok(val) = text.parse::<f32>() {
                        duration_seconds = Some(val);
                    }
                }
            },
            Some("model") => {
                model = field.text().await.ok();
            },
            _ => {},
        }
    }

    let image = image_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Missing required 'image' field".to_string(),
        )
    })?;

    if image.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Image file is empty".to_string()));
    }

    let worker = create_videogen_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let request = ImgToVideoRequest {
        prompt,
        image: bytes::Bytes::from(image),
        duration_secs: duration_seconds,
        fps: None,
        seed: None,
        model,
    };

    let result = worker
        .img_to_video(request)
        .await
        .map_err(|e| map_worker_error("Image-to-video generation failed", e))?;

    let video_url = store_video(&state, &result.video).await?;

    Ok(Json(VideoGenResponse {
        video_url,
        duration_seconds: result.duration_secs,
        fps: result.fps,
        model_used: result.model,
    }))
}

/// Analyze a video.
///
/// Accepts `multipart/form-data` with:
/// - `video` — the video file (required)
/// - `prompt` — optional analysis prompt
#[utoipa::path(
    post,
    path = "/api/v1/ai/video/analyze",
    request_body(
        content_type = "multipart/form-data",
        description = "Video file and optional analysis prompt",
        content = String,
    ),
    responses(
        (status = 200, description = "Video analysis result"),
        (status = 400, description = "Missing or empty video"),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "No video understanding backend configured"),
    ),
    security(("bearerAuth" = [])),
    tag = "video"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn analyze_video(
    mut multipart: Multipart,
) -> Result<Json<VideoAnalysis>, (StatusCode, String)> {
    let mut video_bytes: Option<Vec<u8>> = None;
    let mut prompt: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to read multipart field: {e}"),
        )
    })? {
        match field.name() {
            Some("video") => {
                video_bytes = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| {
                            (
                                StatusCode::BAD_REQUEST,
                                format!("Failed to read video bytes: {e}"),
                            )
                        })?
                        .to_vec(),
                );
            },
            Some("prompt") => {
                prompt = field.text().await.ok();
            },
            _ => {},
        }
    }

    let video = video_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Missing required 'video' field".to_string(),
        )
    })?;

    if video.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Video file is empty".to_string()));
    }

    let worker =
        create_video_understand_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let result = worker
        .analyze(bytes::Bytes::from(video), prompt.as_deref())
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Video analysis failed: {e}"),
            )
        })?;

    Ok(Json(result))
}

/// Extract key frames from a video.
///
/// Accepts `multipart/form-data` with:
/// - `video` — the video file (required)
/// - `max_frames` — maximum number of frames to extract (optional, default 10)
/// - `interval_seconds` — interval between frames in seconds (optional)
#[utoipa::path(
    post,
    path = "/api/v1/ai/video/frames",
    request_body(
        content_type = "multipart/form-data",
        description = "Video file and extraction options",
        content = String,
    ),
    responses(
        (status = 200, description = "Extracted frame metadata", body = ExtractFramesResponse),
        (status = 400, description = "Missing or empty video"),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "No video understanding backend configured"),
    ),
    security(("bearerAuth" = [])),
    tag = "video"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn extract_frames(
    mut multipart: Multipart,
) -> Result<Json<ExtractFramesResponse>, (StatusCode, String)> {
    let mut video_bytes: Option<Vec<u8>> = None;
    let mut max_frames: Option<u32> = None;
    let mut interval_seconds: Option<f32> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to read multipart field: {e}"),
        )
    })? {
        match field.name() {
            Some("video") => {
                video_bytes = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| {
                            (
                                StatusCode::BAD_REQUEST,
                                format!("Failed to read video bytes: {e}"),
                            )
                        })?
                        .to_vec(),
                );
            },
            Some("max_frames") => {
                if let Ok(text) = field.text().await {
                    if let Ok(val) = text.parse::<u32>() {
                        max_frames = Some(val.clamp(1, 100));
                    }
                }
            },
            Some("interval_seconds") => {
                if let Ok(text) = field.text().await {
                    if let Ok(val) = text.parse::<f32>() {
                        interval_seconds = Some(val);
                    }
                }
            },
            _ => {},
        }
    }

    let video = video_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Missing required 'video' field".to_string(),
        )
    })?;

    if video.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Video file is empty".to_string()));
    }

    let worker =
        create_video_understand_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let opts = FrameExtractOpts {
        interval_secs: interval_seconds,
        max_frames: Some(max_frames.unwrap_or(10)),
        timestamps: None,
        width: None,
        height: None,
    };

    let frames = worker
        .extract_frames(bytes::Bytes::from(video), opts)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Frame extraction failed: {e}"),
            )
        })?;

    let frame_infos: Vec<FrameInfo> = frames
        .into_iter()
        .enumerate()
        .map(|(i, f)| FrameInfo {
            index: i,
            timestamp_seconds: f.timestamp_secs,
            width: f.width,
            height: f.height,
        })
        .collect();

    let count = frame_infos.len();
    Ok(Json(ExtractFramesResponse {
        frames: frame_infos,
        count,
    }))
}

/// Transcribe the audio track of a video.
///
/// Accepts `multipart/form-data` with:
/// - `video` — the video file (required)
#[utoipa::path(
    post,
    path = "/api/v1/ai/video/transcribe",
    request_body(
        content_type = "multipart/form-data",
        description = "Video file",
        content = String,
    ),
    responses(
        (status = 200, description = "Video transcript"),
        (status = 400, description = "Missing or empty video"),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "No video understanding backend configured"),
    ),
    security(("bearerAuth" = [])),
    tag = "video"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn transcribe_video(
    mut multipart: Multipart,
) -> Result<Json<VideoTranscript>, (StatusCode, String)> {
    let mut video_bytes: Option<Vec<u8>> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to read multipart field: {e}"),
        )
    })? {
        if field.name() == Some("video") {
            video_bytes = Some(
                field
                    .bytes()
                    .await
                    .map_err(|e| {
                        (
                            StatusCode::BAD_REQUEST,
                            format!("Failed to read video bytes: {e}"),
                        )
                    })?
                    .to_vec(),
            );
        }
    }

    let video = video_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Missing required 'video' field".to_string(),
        )
    })?;

    if video.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Video file is empty".to_string()));
    }

    let worker =
        create_video_understand_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let result = worker
        .transcribe_video(bytes::Bytes::from(video))
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Video transcription failed: {e}"),
            )
        })?;

    Ok(Json(result))
}

/// List available video generation models.
#[utoipa::path(
    get,
    path = "/api/v1/ai/video/models",
    responses(
        (status = 200, description = "List of available video models", body = VideoModelsResponse),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "No video generation backend configured"),
    ),
    security(("bearerAuth" = [])),
    tag = "video"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_models() -> Result<Json<VideoModelsResponse>, (StatusCode, String)> {
    let worker = create_videogen_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let models = worker.list_models().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to list video models: {e}"),
        )
    })?;

    let count = models.len();
    Ok(Json(VideoModelsResponse { models, count }))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
