//! Worker traits and types for all AI capabilities.

pub mod embeddings_mm;
pub mod reranker;
pub mod traits;

pub use traits::{
    // Base trait
    AiWorker,
    // Response types
    AudioGenResult,
    // Specialized traits
    AudioGenWorker,
    DocParseWorker,
    DocumentMetadata,
    ExtractedImage,
    Frame,
    // Request types
    FrameExtractOpts,
    ImageGenRequest,
    ImageGenResult,
    ImageGenWorker,
    Img2ImgRequest,
    ImgToVideoRequest,
    InpaintRequest,
    // Shared types
    ModelInfo,
    MultimodalEmbedWorker,
    MusicGenRequest,
    ParsedDocument,
    ParsedPage,
    ParsedTable,
    RerankResult,
    RerankerWorker,
    SceneDescription,
    SfxGenRequest,
    TranscriptSegment,
    UpscaleRequest,
    VideoAnalysis,
    VideoGenRequest,
    VideoGenResult,
    VideoGenWorker,
    VideoTranscript,
    VideoUnderstandWorker,
    VisionResult,
    VisionWorker,
};
