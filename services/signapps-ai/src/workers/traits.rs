//! AI worker trait definitions for all capabilities.
//!
//! Each worker represents a single AI capability (vision, image generation,
//! etc.) and can be backed by native inference, HTTP APIs, or cloud providers.

use anyhow::Result;
use async_trait::async_trait;
use bytes::Bytes;
use serde::{Deserialize, Serialize};

use crate::gateway::{BackendType, Capability};

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/// Metadata about a model available in a worker.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub vram_required_mb: u64,
    pub quality_score: f32,
}

// ---------------------------------------------------------------------------
// Base trait
// ---------------------------------------------------------------------------

/// Base trait that every AI worker must implement.
#[async_trait]
pub trait AiWorker: Send + Sync {
    /// The capability this worker provides.
    fn capability(&self) -> Capability;

    /// How this worker is connected (native, HTTP, cloud).
    fn backend_type(&self) -> BackendType;

    /// Approximate VRAM needed when the worker is loaded.
    fn required_vram_mb(&self) -> u64;

    /// Quality score for this worker (0.0 .. 1.0).
    fn quality_score(&self) -> f32;

    /// Whether the worker's model is currently loaded and ready.
    fn is_loaded(&self) -> bool;

    /// Lightweight liveness check.
    async fn health_check(&self) -> bool;

    /// Load the model / warm up the backend.
    async fn load(&self) -> Result<()>;

    /// Unload the model / release resources.
    async fn unload(&self) -> Result<()>;
}

// ---------------------------------------------------------------------------
// Vision
// ---------------------------------------------------------------------------

/// Result of a vision operation (describe, VQA).
#[derive(Debug, Clone, Serialize)]
pub struct VisionResult {
    pub text: String,
    pub confidence: f32,
    pub model: String,
}

/// Worker capable of understanding images.
#[async_trait]
pub trait VisionWorker: AiWorker {
    /// Describe an image given an optional prompt.
    async fn describe(&self, image: Bytes, prompt: Option<&str>) -> Result<VisionResult>;

    /// Visual question answering.
    async fn vqa(&self, image: Bytes, question: &str) -> Result<VisionResult>;

    /// Batch-describe multiple images.
    async fn batch_describe(&self, images: Vec<Bytes>) -> Result<Vec<VisionResult>>;
}

// ---------------------------------------------------------------------------
// Image Generation
// ---------------------------------------------------------------------------

/// Request for text-to-image generation.
#[derive(Debug, Clone, Deserialize)]
pub struct ImageGenRequest {
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub num_images: Option<u32>,
    pub seed: Option<i64>,
    pub steps: Option<u32>,
    pub guidance_scale: Option<f32>,
    pub model: Option<String>,
}

/// Request for inpainting (masked region replacement).
#[derive(Debug, Clone, Deserialize)]
pub struct InpaintRequest {
    pub prompt: String,
    pub negative_prompt: Option<String>,
    #[serde(skip)]
    pub image: Bytes,
    #[serde(skip)]
    pub mask: Bytes,
    pub steps: Option<u32>,
    pub guidance_scale: Option<f32>,
    pub model: Option<String>,
}

/// Request for image-to-image transformation.
#[derive(Debug, Clone, Deserialize)]
pub struct Img2ImgRequest {
    pub prompt: String,
    pub negative_prompt: Option<String>,
    #[serde(skip)]
    pub image: Bytes,
    pub strength: Option<f32>,
    pub steps: Option<u32>,
    pub guidance_scale: Option<f32>,
    pub model: Option<String>,
}

/// Request to upscale an image.
#[derive(Debug, Clone, Deserialize)]
pub struct UpscaleRequest {
    #[serde(skip)]
    pub image: Bytes,
    pub scale_factor: Option<u32>,
    pub model: Option<String>,
}

/// Result of an image generation operation.
#[derive(Debug, Clone, Serialize)]
pub struct ImageGenResult {
    /// Generated images (binary; excluded from JSON serialization).
    #[serde(skip)]
    pub images: Vec<Bytes>,
    pub seed: Option<i64>,
    pub model: String,
    pub duration_ms: u64,
}

/// Worker capable of generating and manipulating images.
#[async_trait]
pub trait ImageGenWorker: AiWorker {
    /// Text-to-image generation.
    async fn generate(&self, request: ImageGenRequest) -> Result<ImageGenResult>;

    /// Inpainting: fill in a masked region.
    async fn inpaint(&self, request: InpaintRequest) -> Result<ImageGenResult>;

    /// Image-to-image: transform an existing image.
    async fn img2img(&self, request: Img2ImgRequest) -> Result<ImageGenResult>;

    /// Upscale an image.
    async fn upscale(&self, request: UpscaleRequest) -> Result<ImageGenResult>;

    /// List models available for image generation.
    async fn list_models(&self) -> Result<Vec<ModelInfo>>;
}

// ---------------------------------------------------------------------------
// Video Generation
// ---------------------------------------------------------------------------

/// Request for text-to-video generation.
#[derive(Debug, Clone, Deserialize)]
pub struct VideoGenRequest {
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub duration_secs: Option<f32>,
    pub fps: Option<u32>,
    pub seed: Option<i64>,
    pub model: Option<String>,
}

/// Request for image-to-video generation.
#[derive(Debug, Clone, Deserialize)]
pub struct ImgToVideoRequest {
    pub prompt: Option<String>,
    #[serde(skip)]
    pub image: Bytes,
    pub duration_secs: Option<f32>,
    pub fps: Option<u32>,
    pub seed: Option<i64>,
    pub model: Option<String>,
}

/// Result of a video generation operation.
#[derive(Debug, Clone, Serialize)]
pub struct VideoGenResult {
    /// Generated video (binary; excluded from JSON serialization).
    #[serde(skip)]
    pub video: Bytes,
    pub duration_secs: f32,
    pub fps: u32,
    pub model: String,
    pub duration_ms: u64,
}

/// Worker capable of generating videos.
#[async_trait]
pub trait VideoGenWorker: AiWorker {
    /// Generate a video from a text prompt.
    async fn text_to_video(&self, request: VideoGenRequest) -> Result<VideoGenResult>;

    /// Generate a video from an input image.
    async fn img_to_video(&self, request: ImgToVideoRequest) -> Result<VideoGenResult>;

    /// List models available for video generation.
    async fn list_models(&self) -> Result<Vec<ModelInfo>>;
}

// ---------------------------------------------------------------------------
// Video Understanding
// ---------------------------------------------------------------------------

/// A single scene detected in a video.
#[derive(Debug, Clone, Serialize)]
pub struct SceneDescription {
    pub start_secs: f32,
    pub end_secs: f32,
    pub description: String,
    pub confidence: f32,
}

/// Overall analysis of a video.
#[derive(Debug, Clone, Serialize)]
pub struct VideoAnalysis {
    pub summary: String,
    pub scenes: Vec<SceneDescription>,
    pub model: String,
    pub duration_ms: u64,
}

/// A single extracted frame from a video.
#[derive(Debug, Clone, Serialize)]
pub struct Frame {
    pub timestamp_secs: f32,
    /// Frame image data (binary; excluded from JSON serialization).
    #[serde(skip)]
    pub image: Bytes,
    pub width: u32,
    pub height: u32,
}

/// A timestamped segment of a video transcript.
#[derive(Debug, Clone, Serialize)]
pub struct TranscriptSegment {
    pub start_secs: f32,
    pub end_secs: f32,
    pub text: String,
    pub confidence: f32,
}

/// Full transcript of a video's audio track.
#[derive(Debug, Clone, Serialize)]
pub struct VideoTranscript {
    pub segments: Vec<TranscriptSegment>,
    pub full_text: String,
    pub language: Option<String>,
    pub duration_ms: u64,
}

/// Options for frame extraction.
#[derive(Debug, Clone, Deserialize)]
pub struct FrameExtractOpts {
    pub interval_secs: Option<f32>,
    pub max_frames: Option<u32>,
    pub timestamps: Option<Vec<f32>>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// Worker capable of understanding video content.
#[async_trait]
pub trait VideoUnderstandWorker: AiWorker {
    /// Analyze a video with an optional prompt.
    async fn analyze(&self, video: Bytes, prompt: Option<&str>) -> Result<VideoAnalysis>;

    /// Extract frames from a video.
    async fn extract_frames(&self, video: Bytes, opts: FrameExtractOpts) -> Result<Vec<Frame>>;

    /// Transcribe the audio track of a video.
    async fn transcribe_video(&self, video: Bytes) -> Result<VideoTranscript>;
}

// ---------------------------------------------------------------------------
// Audio Generation
// ---------------------------------------------------------------------------

/// Request for music generation.
#[derive(Debug, Clone, Deserialize)]
pub struct MusicGenRequest {
    pub prompt: String,
    pub duration_secs: Option<f32>,
    pub temperature: Option<f32>,
    pub seed: Option<i64>,
    pub model: Option<String>,
}

/// Request for sound-effect generation.
#[derive(Debug, Clone, Deserialize)]
pub struct SfxGenRequest {
    pub prompt: String,
    pub duration_secs: Option<f32>,
    pub seed: Option<i64>,
    pub model: Option<String>,
}

/// Result of an audio generation operation.
#[derive(Debug, Clone, Serialize)]
pub struct AudioGenResult {
    /// Generated audio (binary; excluded from JSON serialization).
    #[serde(skip)]
    pub audio: Bytes,
    pub duration_secs: f32,
    pub sample_rate: u32,
    pub model: String,
    pub duration_ms: u64,
}

/// Worker capable of generating audio (music and sound effects).
#[async_trait]
pub trait AudioGenWorker: AiWorker {
    /// Generate music from a text prompt.
    async fn generate_music(&self, request: MusicGenRequest) -> Result<AudioGenResult>;

    /// Generate a sound effect from a text prompt.
    async fn generate_sfx(&self, request: SfxGenRequest) -> Result<AudioGenResult>;

    /// List models available for audio generation.
    async fn list_models(&self) -> Result<Vec<ModelInfo>>;
}

// ---------------------------------------------------------------------------
// Reranker
// ---------------------------------------------------------------------------

/// A single reranking result with relevance score.
#[derive(Debug, Clone, Serialize)]
pub struct RerankResult {
    pub index: usize,
    pub score: f32,
    pub text: String,
}

/// Worker capable of reranking documents by relevance.
#[async_trait]
pub trait RerankerWorker: AiWorker {
    /// Rerank documents against a query and return the top-k results.
    async fn rerank(
        &self,
        query: &str,
        documents: Vec<String>,
        top_k: Option<usize>,
    ) -> Result<Vec<RerankResult>>;
}

// ---------------------------------------------------------------------------
// Document Parsing
// ---------------------------------------------------------------------------

/// Metadata extracted from a parsed document.
#[derive(Debug, Clone, Serialize)]
pub struct DocumentMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub page_count: Option<u32>,
    pub language: Option<String>,
    pub created_at: Option<String>,
}

/// An image extracted from a document.
#[derive(Debug, Clone, Serialize)]
pub struct ExtractedImage {
    pub page: u32,
    /// Extracted image data (binary; excluded from JSON serialization).
    #[serde(skip)]
    pub image: Bytes,
    pub alt_text: Option<String>,
    pub width: u32,
    pub height: u32,
}

/// A single page of a parsed document.
#[derive(Debug, Clone, Serialize)]
pub struct ParsedPage {
    pub page_number: u32,
    pub text: String,
    pub images: Vec<ExtractedImage>,
}

/// A table extracted from a document.
#[derive(Debug, Clone, Serialize)]
pub struct ParsedTable {
    pub page: u32,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

/// A fully parsed document with pages, tables, and metadata.
#[derive(Debug, Clone, Serialize)]
pub struct ParsedDocument {
    pub pages: Vec<ParsedPage>,
    pub tables: Vec<ParsedTable>,
    pub metadata: DocumentMetadata,
    pub full_text: String,
}

/// Worker capable of parsing documents (PDF, DOCX, etc.).
#[async_trait]
pub trait DocParseWorker: AiWorker {
    /// Parse a document into structured pages and text.
    async fn parse(&self, doc: Bytes, filename: &str) -> Result<ParsedDocument>;

    /// Extract only tables from a document.
    async fn extract_tables(&self, doc: Bytes) -> Result<Vec<ParsedTable>>;
}

// ---------------------------------------------------------------------------
// Multimodal Embeddings
// ---------------------------------------------------------------------------

/// Worker capable of producing embeddings from multiple modalities.
#[async_trait]
pub trait MultimodalEmbedWorker: AiWorker {
    /// Embed text inputs into vectors.
    async fn embed_text(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>>;

    /// Embed images into vectors.
    async fn embed_image(&self, images: Vec<Bytes>) -> Result<Vec<Vec<f32>>>;

    /// Embed audio inputs into vectors.
    async fn embed_audio(&self, audio: Vec<Bytes>) -> Result<Vec<Vec<f32>>>;
}
