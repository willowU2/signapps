#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// AI capabilities that the gateway can route.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Capability {
    Llm,
    Vision,
    ImageGen,
    VideoGen,
    VideoUnderstand,
    AudioGen,
    Rerank,
    DocParse,
    TextEmbed,
    MultimodalEmbed,
}

impl Capability {
    /// Returns a static slice of all capability variants.
    pub fn all() -> &'static [Capability] {
        &[
            Capability::Llm,
            Capability::Vision,
            Capability::ImageGen,
            Capability::VideoGen,
            Capability::VideoUnderstand,
            Capability::AudioGen,
            Capability::Rerank,
            Capability::DocParse,
            Capability::TextEmbed,
            Capability::MultimodalEmbed,
        ]
    }

    /// Returns a human-readable display name for this capability.
    pub fn display_name(&self) -> &'static str {
        match self {
            Capability::Llm => "Large Language Model",
            Capability::Vision => "Vision",
            Capability::ImageGen => "Image Generation",
            Capability::VideoGen => "Video Generation",
            Capability::VideoUnderstand => "Video Understanding",
            Capability::AudioGen => "Audio Generation",
            Capability::Rerank => "Reranking",
            Capability::DocParse => "Document Parsing",
            Capability::TextEmbed => "Text Embeddings",
            Capability::MultimodalEmbed => "Multimodal Embeddings",
        }
    }
}

/// How a backend is connected.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BackendType {
    Native,
    Http { url: String },
    Cloud { provider: String },
}

/// Hardware tier based on available VRAM.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HardwareTier {
    Cpu,
    LowVram,
    MidVram,
    HighVram,
    UltraVram,
}

impl HardwareTier {
    /// Determine the hardware tier from available VRAM in megabytes.
    pub fn from_vram_mb(vram_mb: u64) -> Self {
        match vram_mb {
            0 => HardwareTier::Cpu,
            1..=4095 => HardwareTier::LowVram,
            4096..=8191 => HardwareTier::MidVram,
            8192..=23999 => HardwareTier::HighVram,
            _ => HardwareTier::UltraVram,
        }
    }
}

/// Profile describing a single capability's availability and quality.
#[derive(Debug, Clone, Serialize)]
pub struct CapabilityProfile {
    pub capability: Capability,
    pub available: bool,
    pub recommended_model: Option<String>,
    pub quality_score: f32,
    pub cloud_quality_score: f32,
    pub upgrade_recommended: bool,
    pub vram_required_mb: u64,
}

/// Detailed information about a capability including its backends.
#[derive(Debug, Clone, Serialize)]
pub struct CapabilityInfo {
    pub capability: Capability,
    pub available: bool,
    pub backends: Vec<BackendInfo>,
    pub active_backend: Option<String>,
    pub local_quality: f32,
    pub cloud_quality: f32,
    pub upgrade_recommended: bool,
    pub gpu_loaded: bool,
    pub vram_required_mb: u64,
}

/// Information about a specific backend for a capability.
#[derive(Debug, Clone, Serialize)]
pub struct BackendInfo {
    pub name: String,
    pub backend_type: BackendType,
    pub quality_score: f32,
    pub available: bool,
}
