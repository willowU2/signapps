//! Hardware-tier model recommendations and load profiles.
#![allow(dead_code)]

use serde::Serialize;

use crate::gateway::{Capability, HardwareTier};

/// A single model recommendation for a capability.
#[derive(Debug, Clone, Serialize)]
pub struct ModelRecommendation {
    pub capability: Capability,
    pub model_id: String,
    pub model_name: String,
    pub vram_mb: u64,
    pub quality_score: f32,
}

/// A complete load profile for a hardware tier.
#[derive(Debug, Clone, Serialize)]
pub struct LoadProfile {
    pub name: String,
    pub tier: HardwareTier,
    pub description: String,
    pub recommendations: Vec<ModelRecommendation>,
    pub total_vram_required_mb: u64,
}

/// Return recommended models for the given hardware tier.
pub fn recommend_models(tier: HardwareTier) -> Vec<ModelRecommendation> {
    match tier {
        HardwareTier::Cpu => vec![
            ModelRecommendation {
                capability: Capability::TextEmbed,
                model_id: "nomic-embed-text-v1.5".into(),
                model_name: "Nomic Embed Text v1.5".into(),
                vram_mb: 0,
                quality_score: 0.7,
            },
            ModelRecommendation {
                capability: Capability::Rerank,
                model_id: "bge-reranker-base".into(),
                model_name: "BGE Reranker Base".into(),
                vram_mb: 0,
                quality_score: 0.5,
            },
        ],

        HardwareTier::LowVram => vec![
            ModelRecommendation {
                capability: Capability::Llm,
                model_id: "llama-3.2-3b-q4".into(),
                model_name: "Llama 3.2 3B Q4".into(),
                vram_mb: 2048,
                quality_score: 0.55,
            },
            ModelRecommendation {
                capability: Capability::TextEmbed,
                model_id: "nomic-embed-text-v1.5".into(),
                model_name: "Nomic Embed Text v1.5".into(),
                vram_mb: 0,
                quality_score: 0.7,
            },
            ModelRecommendation {
                capability: Capability::Rerank,
                model_id: "bge-reranker-base".into(),
                model_name: "BGE Reranker Base".into(),
                vram_mb: 0,
                quality_score: 0.5,
            },
            ModelRecommendation {
                capability: Capability::MultimodalEmbed,
                model_id: "siglip-base-patch16-224".into(),
                model_name: "SigLIP Base".into(),
                vram_mb: 400,
                quality_score: 0.5,
            },
            ModelRecommendation {
                capability: Capability::Vision,
                model_id: "moondream2".into(),
                model_name: "MoonDream2".into(),
                vram_mb: 1800,
                quality_score: 0.45,
            },
            ModelRecommendation {
                capability: Capability::ImageGen,
                model_id: "sd-turbo".into(),
                model_name: "SD Turbo".into(),
                vram_mb: 2048,
                quality_score: 0.4,
            },
        ],

        HardwareTier::MidVram => vec![
            ModelRecommendation {
                capability: Capability::Llm,
                model_id: "llama-3.1-8b-q4".into(),
                model_name: "Llama 3.1 8B Q4".into(),
                vram_mb: 6144,
                quality_score: 0.7,
            },
            ModelRecommendation {
                capability: Capability::TextEmbed,
                model_id: "nomic-embed-text-v1.5".into(),
                model_name: "Nomic Embed Text v1.5".into(),
                vram_mb: 0,
                quality_score: 0.7,
            },
            ModelRecommendation {
                capability: Capability::Rerank,
                model_id: "bge-reranker-large".into(),
                model_name: "BGE Reranker Large".into(),
                vram_mb: 512,
                quality_score: 0.7,
            },
            ModelRecommendation {
                capability: Capability::MultimodalEmbed,
                model_id: "siglip-large-patch16-384".into(),
                model_name: "SigLIP Large".into(),
                vram_mb: 800,
                quality_score: 0.7,
            },
            ModelRecommendation {
                capability: Capability::Vision,
                model_id: "internvl2-2b".into(),
                model_name: "InternVL2 2B".into(),
                vram_mb: 2048,
                quality_score: 0.6,
            },
            ModelRecommendation {
                capability: Capability::ImageGen,
                model_id: "flux-1-schnell".into(),
                model_name: "FLUX.1 schnell".into(),
                vram_mb: 6144,
                quality_score: 0.7,
            },
            ModelRecommendation {
                capability: Capability::VideoGen,
                model_id: "cogvideox-2b".into(),
                model_name: "CogVideoX 2B".into(),
                vram_mb: 6144,
                quality_score: 0.5,
            },
            ModelRecommendation {
                capability: Capability::DocParse,
                model_id: "got-ocr2".into(),
                model_name: "GOT-OCR2".into(),
                vram_mb: 2048,
                quality_score: 0.65,
            },
        ],

        HardwareTier::HighVram => vec![
            ModelRecommendation {
                capability: Capability::Llm,
                model_id: "qwen2.5-32b-q4".into(),
                model_name: "Qwen 2.5 32B Q4".into(),
                vram_mb: 22528,
                quality_score: 0.9,
            },
            ModelRecommendation {
                capability: Capability::TextEmbed,
                model_id: "nomic-embed-text-v1.5".into(),
                model_name: "Nomic Embed Text v1.5".into(),
                vram_mb: 0,
                quality_score: 0.7,
            },
            ModelRecommendation {
                capability: Capability::Rerank,
                model_id: "bge-reranker-v2-m3".into(),
                model_name: "BGE Reranker v2 M3".into(),
                vram_mb: 1024,
                quality_score: 0.85,
            },
            ModelRecommendation {
                capability: Capability::MultimodalEmbed,
                model_id: "siglip-large-patch16-384".into(),
                model_name: "SigLIP Large".into(),
                vram_mb: 800,
                quality_score: 0.7,
            },
            ModelRecommendation {
                capability: Capability::Vision,
                model_id: "internvl2-8b".into(),
                model_name: "InternVL2 8B".into(),
                vram_mb: 8192,
                quality_score: 0.8,
            },
            ModelRecommendation {
                capability: Capability::ImageGen,
                model_id: "flux-1-dev".into(),
                model_name: "FLUX.1 dev".into(),
                vram_mb: 12288,
                quality_score: 0.85,
            },
            ModelRecommendation {
                capability: Capability::VideoGen,
                model_id: "cogvideox-5b".into(),
                model_name: "CogVideoX 5B".into(),
                vram_mb: 10240,
                quality_score: 0.7,
            },
            ModelRecommendation {
                capability: Capability::AudioGen,
                model_id: "musicgen-medium".into(),
                model_name: "MusicGen Medium".into(),
                vram_mb: 4096,
                quality_score: 0.7,
            },
            ModelRecommendation {
                capability: Capability::DocParse,
                model_id: "got-ocr2".into(),
                model_name: "GOT-OCR2".into(),
                vram_mb: 2048,
                quality_score: 0.65,
            },
        ],

        HardwareTier::UltraVram => vec![
            ModelRecommendation {
                capability: Capability::Llm,
                model_id: "qwen2.5-72b-q4".into(),
                model_name: "Qwen 2.5 72B Q4".into(),
                vram_mb: 44032,
                quality_score: 0.95,
            },
            ModelRecommendation {
                capability: Capability::TextEmbed,
                model_id: "nomic-embed-text-v1.5".into(),
                model_name: "Nomic Embed Text v1.5".into(),
                vram_mb: 0,
                quality_score: 0.7,
            },
            ModelRecommendation {
                capability: Capability::Rerank,
                model_id: "bge-reranker-v2-m3".into(),
                model_name: "BGE Reranker v2 M3".into(),
                vram_mb: 1024,
                quality_score: 0.85,
            },
            ModelRecommendation {
                capability: Capability::MultimodalEmbed,
                model_id: "siglip-so400m-patch14-384".into(),
                model_name: "SigLIP SO400M".into(),
                vram_mb: 1600,
                quality_score: 0.85,
            },
            ModelRecommendation {
                capability: Capability::Vision,
                model_id: "qwen2-vl-72b".into(),
                model_name: "Qwen2-VL 72B".into(),
                vram_mb: 44032,
                quality_score: 0.95,
            },
            ModelRecommendation {
                capability: Capability::ImageGen,
                model_id: "flux-1-dev".into(),
                model_name: "FLUX.1 dev".into(),
                vram_mb: 12288,
                quality_score: 0.85,
            },
            ModelRecommendation {
                capability: Capability::VideoGen,
                model_id: "cogvideox-5b".into(),
                model_name: "CogVideoX 5B".into(),
                vram_mb: 10240,
                quality_score: 0.7,
            },
            ModelRecommendation {
                capability: Capability::VideoUnderstand,
                model_id: "internvl2-40b".into(),
                model_name: "InternVL2 40B".into(),
                vram_mb: 24576,
                quality_score: 0.9,
            },
            ModelRecommendation {
                capability: Capability::AudioGen,
                model_id: "musicgen-large".into(),
                model_name: "MusicGen Large".into(),
                vram_mb: 8192,
                quality_score: 0.85,
            },
            ModelRecommendation {
                capability: Capability::DocParse,
                model_id: "got-ocr2".into(),
                model_name: "GOT-OCR2".into(),
                vram_mb: 2048,
                quality_score: 0.65,
            },
        ],
    }
}

/// Build a complete load profile for the given hardware tier.
pub fn build_profile(tier: HardwareTier) -> LoadProfile {
    let recommendations = recommend_models(tier);
    let total_vram_required_mb: u64 = recommendations.iter().map(|r| r.vram_mb).sum();

    let (name, description) = match tier {
        HardwareTier::Cpu => (
            "CPU Only",
            "Text embeddings and basic reranking. No GPU-accelerated inference.",
        ),
        HardwareTier::LowVram => (
            "Low VRAM (< 4 GB)",
            "Small LLM, basic vision, lightweight image generation.",
        ),
        HardwareTier::MidVram => (
            "Mid VRAM (4-8 GB)",
            "Quality LLM, vision, image generation, and basic video.",
        ),
        HardwareTier::HighVram => (
            "High VRAM (8-24 GB)",
            "High-quality LLM, advanced vision, FLUX image gen, video, and audio.",
        ),
        HardwareTier::UltraVram => (
            "Ultra VRAM (24+ GB)",
            "Top-tier models across all capabilities including 72B LLM and video understanding.",
        ),
    };

    LoadProfile {
        name: name.to_string(),
        tier,
        description: description.to_string(),
        recommendations,
        total_vram_required_mb,
    }
}
