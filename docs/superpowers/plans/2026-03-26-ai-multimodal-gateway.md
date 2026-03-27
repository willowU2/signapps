# AI Multimodal Gateway — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform signapps-ai into a unified AI gateway with multimodal capabilities, circular RAG pipeline, intelligent local/cloud routing, and multi-GPU model orchestration.

**Architecture:** signapps-ai becomes the single AI gateway. All capabilities (vision, image gen, video, audio, reranking, doc parsing) are exposed as trait-based workers with Native/HTTP/Cloud backends. A model orchestrator manages VRAM across 2 GPUs. Dual-space pgvector (text 384d + multimodal 1024d) enables cross-modal search with RRF fusion.

**Tech Stack:** Rust (Axum), candle (image/video/audio gen), ort/ONNX Runtime (reranker, SigLIP), llama-cpp-2 (LLM, vision), ffmpeg-next (video), pgvector (embeddings), Next.js 16 (frontend).

**Spec:** `docs/superpowers/specs/2026-03-26-ai-multimodal-gateway-design.md`

---

## Phase Overview

| Phase | Name | Dependencies | Deliverable |
|-------|------|-------------|-------------|
| 1 | Gateway Core | None | Traits, router, capability registry, model orchestrator |
| 2 | SQL Migration + DB Layer | Phase 1 | New tables, MultimodalVectorRepository |
| 3 | Reranker + Multimodal Embeddings Workers | Phase 2 | First workers (lightweight, validate pattern) |
| 4 | RAG Multimodal | Phase 3 | Dual-space indexer, fusion search, circular pipeline |
| 5 | Conversation Memory | Phase 2 | Persistent history, context builder, auto-summary |
| 6 | Vision + DocParse Workers | Phase 1 | Image analysis, VQA, document parsing |
| 7 | Image Generation Worker | Phase 1 | Text-to-image, inpaint, img2img via FLUX/SD |
| 8 | Video Workers | Phase 1,6 | Video understanding + generation |
| 9 | Audio Generation Worker | Phase 1 | Music + SFX generation |
| 10 | Chat Enrichment | Phase 4,5 | Multimodal chat with attachments + media gen |
| 11 | Frontend — Dashboard & GPU Monitor | Phase 1 | Capability dashboard, VRAM monitor |
| 12 | Frontend — Studio & Panels | Phase 7,8,9 | Image/video/audio gen panels, multimodal search |

---

## Phase 1: Gateway Core

### Task 1.1: Add Capability and BackendType enums

**Files:**
- Create: `services/signapps-ai/src/gateway/mod.rs`
- Create: `services/signapps-ai/src/gateway/capability.rs`

- [ ] **Step 1: Create gateway module with Capability and BackendType**

Create `services/signapps-ai/src/gateway/mod.rs`:
```rust
pub mod capability;
pub mod router;
pub mod quality_advisor;

pub use capability::{BackendType, Capability, CapabilityInfo, CapabilityProfile, HardwareTier};
pub use router::GatewayRouter;
pub use quality_advisor::{QualityAdvice, QualityAdvisor};
```

Create `services/signapps-ai/src/gateway/capability.rs`:
```rust
use serde::{Deserialize, Serialize};

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

    pub fn display_name(&self) -> &'static str {
        match self {
            Capability::Llm => "LLM Chat",
            Capability::Vision => "Vision / VQA",
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum BackendType {
    Native,
    Http { url: String },
    Cloud { provider: String },
}

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
    pub fn from_vram_mb(vram_mb: u64) -> Self {
        match vram_mb {
            0 => HardwareTier::Cpu,
            1..=8192 => HardwareTier::LowVram,
            8193..=16384 => HardwareTier::MidVram,
            16385..=24576 => HardwareTier::HighVram,
            _ => HardwareTier::UltraVram,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct CapabilityProfile {
    pub capability: Capability,
    pub available: bool,
    pub recommended_model: String,
    pub quality_score: f32,
    pub cloud_quality_score: f32,
    pub upgrade_recommended: bool,
    pub vram_required_mb: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CapabilityInfo {
    pub capability: Capability,
    pub available: bool,
    pub backends: Vec<BackendInfo>,
    pub active_backend: String,
    pub local_quality: f32,
    pub cloud_quality: Option<f32>,
    pub upgrade_recommended: bool,
    pub gpu_loaded: bool,
    pub vram_required_mb: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct BackendInfo {
    pub name: String,
    pub backend_type: BackendType,
    pub quality_score: f32,
    pub available: bool,
}
```

- [ ] **Step 2: Verify it compiles**

Run: `rtk cargo check -p signapps-ai 2>&1 | head -5`

Note: This will fail because `router` and `quality_advisor` modules don't exist yet. Create stubs:

Create `services/signapps-ai/src/gateway/router.rs`:
```rust
pub struct GatewayRouter;
```

Create `services/signapps-ai/src/gateway/quality_advisor.rs`:
```rust
use serde::Serialize;
use super::capability::Capability;

#[derive(Debug, Clone, Serialize)]
pub struct QualityAdvice {
    pub capability: Capability,
    pub local_quality: f32,
    pub cloud_quality: f32,
    pub recommendation: String,
    pub cloud_provider: Option<String>,
}

pub struct QualityAdvisor;
```

- [ ] **Step 3: Register gateway module in main**

In `services/signapps-ai/src/main.rs`, add `mod gateway;` alongside other module declarations.

- [ ] **Step 4: Verify compilation**

Run: `rtk cargo check -p signapps-ai`
Expected: compiles with no errors

- [ ] **Step 5: Commit**

```bash
rtk git add services/signapps-ai/src/gateway/
rtk git commit -m "feat(ai): add gateway module with Capability and BackendType enums"
```

---

### Task 1.2: Define AiWorker trait and worker-specific traits

**Files:**
- Create: `services/signapps-ai/src/workers/mod.rs`
- Create: `services/signapps-ai/src/workers/traits.rs`

- [ ] **Step 1: Create workers module with all trait definitions**

Create `services/signapps-ai/src/workers/mod.rs`:
```rust
pub mod traits;

pub use traits::*;
```

Create `services/signapps-ai/src/workers/traits.rs`:
```rust
use anyhow::Result;
use async_trait::async_trait;
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::gateway::{BackendType, Capability};

// ─── Base trait ─────────────────────────────────────────

#[async_trait]
pub trait AiWorker: Send + Sync {
    fn capability(&self) -> Capability;
    fn backend_type(&self) -> BackendType;
    fn required_vram_mb(&self) -> u64;
    fn quality_score(&self) -> f32;
    fn is_loaded(&self) -> bool;
    async fn health_check(&self) -> bool;
    async fn load(&self) -> Result<()>;
    async fn unload(&self) -> Result<()>;
}

// ─── Vision ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct VisionResult {
    pub description: String,
    pub confidence: f32,
    pub model_used: String,
}

#[async_trait]
pub trait VisionWorker: AiWorker {
    async fn describe(&self, image: Bytes, prompt: Option<String>) -> Result<VisionResult>;
    async fn vqa(&self, image: Bytes, question: &str) -> Result<VisionResult>;
    async fn batch_describe(&self, images: Vec<Bytes>) -> Result<Vec<VisionResult>>;
}

// ─── Image Generation ───────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct ImageGenRequest {
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub num_steps: Option<u32>,
    pub guidance_scale: Option<f32>,
    pub seed: Option<i64>,
    pub model: Option<String>,
    pub style: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImageGenResult {
    pub image_data: Bytes,
    pub width: u32,
    pub height: u32,
    pub seed_used: i64,
    pub model_used: String,
    pub format: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InpaintRequest {
    pub prompt: String,
    pub image: Bytes,
    pub mask: Bytes,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Img2ImgRequest {
    pub prompt: String,
    pub image: Bytes,
    pub strength: Option<f32>,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpscaleRequest {
    pub image: Bytes,
    pub scale: Option<u32>,
    pub model: Option<String>,
}

#[async_trait]
pub trait ImageGenWorker: AiWorker {
    async fn generate(&self, req: ImageGenRequest) -> Result<ImageGenResult>;
    async fn inpaint(&self, req: InpaintRequest) -> Result<ImageGenResult>;
    async fn img2img(&self, req: Img2ImgRequest) -> Result<ImageGenResult>;
    async fn upscale(&self, req: UpscaleRequest) -> Result<ImageGenResult>;
    async fn list_models(&self) -> Result<Vec<ModelInfo>>;
}

// ─── Video Generation ───────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct VideoGenRequest {
    pub prompt: String,
    pub duration_seconds: Option<f32>,
    pub fps: Option<u32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub source_image: Option<Bytes>,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct VideoGenResult {
    pub video_data: Bytes,
    pub duration_seconds: f32,
    pub fps: u32,
    pub width: u32,
    pub height: u32,
    pub model_used: String,
    pub format: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ImgToVideoRequest {
    pub image: Bytes,
    pub prompt: Option<String>,
    pub duration_seconds: Option<f32>,
    pub model: Option<String>,
}

#[async_trait]
pub trait VideoGenWorker: AiWorker {
    async fn text_to_video(&self, req: VideoGenRequest) -> Result<VideoGenResult>;
    async fn img_to_video(&self, req: ImgToVideoRequest) -> Result<VideoGenResult>;
    async fn list_models(&self) -> Result<Vec<ModelInfo>>;
}

// ─── Video Understanding ────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct VideoAnalysis {
    pub description: String,
    pub scenes: Vec<SceneDescription>,
    pub duration_seconds: f32,
    pub model_used: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SceneDescription {
    pub timestamp_start: f32,
    pub timestamp_end: f32,
    pub description: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FrameExtractOpts {
    pub max_frames: Option<usize>,
    pub interval_seconds: Option<f32>,
    pub scene_detect: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Frame {
    pub index: usize,
    pub timestamp_seconds: f32,
    pub data: Bytes,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct VideoTranscript {
    pub text: String,
    pub segments: Vec<TranscriptSegment>,
    pub language: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TranscriptSegment {
    pub start: f32,
    pub end: f32,
    pub text: String,
}

#[async_trait]
pub trait VideoUnderstandWorker: AiWorker {
    async fn analyze(&self, video: Bytes, prompt: Option<String>) -> Result<VideoAnalysis>;
    async fn extract_frames(&self, video: Bytes, opts: FrameExtractOpts) -> Result<Vec<Frame>>;
    async fn transcribe_video(&self, video: Bytes) -> Result<VideoTranscript>;
}

// ─── Audio Generation ───────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct MusicGenRequest {
    pub prompt: String,
    pub duration_seconds: Option<f32>,
    pub temperature: Option<f32>,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SfxGenRequest {
    pub prompt: String,
    pub duration_seconds: Option<f32>,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AudioGenResult {
    pub audio_data: Bytes,
    pub duration_seconds: f32,
    pub sample_rate: u32,
    pub model_used: String,
    pub format: String,
}

#[async_trait]
pub trait AudioGenWorker: AiWorker {
    async fn generate_music(&self, req: MusicGenRequest) -> Result<AudioGenResult>;
    async fn generate_sfx(&self, req: SfxGenRequest) -> Result<AudioGenResult>;
    async fn list_models(&self) -> Result<Vec<ModelInfo>>;
}

// ─── Reranking ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct RerankResult {
    pub index: usize,
    pub score: f32,
    pub text: String,
}

#[async_trait]
pub trait RerankerWorker: AiWorker {
    async fn rerank(
        &self,
        query: &str,
        documents: Vec<String>,
        top_k: usize,
    ) -> Result<Vec<RerankResult>>;
}

// ─── Document Parsing ───────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ParsedDocument {
    pub text: String,
    pub pages: Vec<ParsedPage>,
    pub metadata: DocumentMetadata,
}

#[derive(Debug, Clone, Serialize)]
pub struct ParsedPage {
    pub page_number: u32,
    pub text: String,
    pub tables: Vec<ParsedTable>,
    pub images: Vec<ExtractedImage>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ParsedTable {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExtractedImage {
    pub data: Bytes,
    pub caption: Option<String>,
    pub page: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct DocumentMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub page_count: u32,
    pub word_count: usize,
}

#[async_trait]
pub trait DocParseWorker: AiWorker {
    async fn parse(&self, doc: Bytes, filename: &str) -> Result<ParsedDocument>;
    async fn extract_tables(&self, doc: Bytes) -> Result<Vec<ParsedTable>>;
}

// ─── Multimodal Embeddings ──────────────────────────────

#[async_trait]
pub trait MultimodalEmbedWorker: AiWorker {
    async fn embed_text(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>>;
    async fn embed_image(&self, images: Vec<Bytes>) -> Result<Vec<Vec<f32>>>;
    async fn embed_audio(&self, audio: Vec<Bytes>) -> Result<Vec<Vec<f32>>>;
}

// ─── Shared types ───────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub vram_required_mb: u64,
    pub quality_score: f32,
}
```

- [ ] **Step 2: Add `bytes` dependency if missing**

Check `services/signapps-ai/Cargo.toml` for `bytes`. If missing, add:
```toml
bytes = "1"
```

- [ ] **Step 3: Register workers module in main.rs**

Add `mod workers;` in `services/signapps-ai/src/main.rs`.

- [ ] **Step 4: Verify compilation**

Run: `rtk cargo check -p signapps-ai`
Expected: compiles (traits have no implementations yet)

- [ ] **Step 5: Commit**

```bash
rtk git add services/signapps-ai/src/workers/
rtk git commit -m "feat(ai): define AiWorker trait and all worker-specific traits"
```

---

### Task 1.3: Implement Model Orchestrator

**Files:**
- Create: `services/signapps-ai/src/models/mod.rs`
- Create: `services/signapps-ai/src/models/orchestrator.rs`
- Create: `services/signapps-ai/src/models/profiles.rs`

- [ ] **Step 1: Create models module**

Create `services/signapps-ai/src/models/mod.rs`:
```rust
pub mod orchestrator;
pub mod profiles;

pub use orchestrator::{GpuRole, GpuState, LoadedModel, ModelOrchestrator};
pub use profiles::{LoadProfile, ModelRecommendation};
```

- [ ] **Step 2: Create ModelOrchestrator**

Create `services/signapps-ai/src/models/orchestrator.rs`:
```rust
use std::collections::VecDeque;
use std::sync::Arc;

use anyhow::{anyhow, Result};
use dashmap::DashMap;
use serde::Serialize;
use tokio::sync::Mutex;
use tracing::{info, warn};

use signapps_runtime::{HardwareProfile, ModelManager};

use crate::gateway::Capability;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum GpuRole {
    AlwaysOn,
    DynamicPool,
}

#[derive(Debug, Clone, Serialize)]
pub struct LoadedModel {
    pub model_id: String,
    pub capability: Capability,
    pub vram_mb: u64,
    pub loaded_at: chrono::DateTime<chrono::Utc>,
    pub last_used: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GpuState {
    pub id: usize,
    pub name: String,
    pub total_vram_mb: u64,
    pub used_vram_mb: u64,
    pub loaded_models: Vec<LoadedModel>,
    pub role: GpuRole,
}

impl GpuState {
    pub fn free_vram_mb(&self) -> u64 {
        self.total_vram_mb.saturating_sub(self.used_vram_mb)
    }
}

#[derive(Debug)]
struct LoadRequest {
    model_id: String,
    capability: Capability,
    vram_needed: u64,
}

pub struct ModelOrchestrator {
    gpus: Mutex<Vec<GpuState>>,
    ram_models: DashMap<String, LoadedModel>,
    loading_queue: Mutex<VecDeque<LoadRequest>>,
    model_manager: Arc<ModelManager>,
    hardware: HardwareProfile,
}

impl ModelOrchestrator {
    pub fn new(model_manager: Arc<ModelManager>, hardware: HardwareProfile) -> Self {
        let mut gpus = Vec::new();
        for (i, gpu) in hardware.gpus.iter().enumerate() {
            gpus.push(GpuState {
                id: i,
                name: gpu.name.clone(),
                total_vram_mb: gpu.vram_mb,
                used_vram_mb: 0,
                loaded_models: Vec::new(),
                role: if i == 0 { GpuRole::AlwaysOn } else { GpuRole::DynamicPool },
            });
        }
        Self {
            gpus: Mutex::new(gpus),
            ram_models: DashMap::new(),
            loading_queue: Mutex::new(VecDeque::new()),
            model_manager,
            hardware,
        }
    }

    pub async fn gpu_status(&self) -> Vec<GpuState> {
        self.gpus.lock().await.clone()
    }

    pub async fn total_free_vram(&self) -> u64 {
        self.gpus.lock().await.iter().map(|g| g.free_vram_mb()).sum()
    }

    pub async fn is_model_loaded(&self, model_id: &str) -> bool {
        let gpus = self.gpus.lock().await;
        gpus.iter()
            .any(|g| g.loaded_models.iter().any(|m| m.model_id == model_id))
            || self.ram_models.contains_key(model_id)
    }

    /// Ensure a model is downloaded and ready. Returns the local path.
    pub async fn ensure_model_available(&self, model_id: &str) -> Result<std::path::PathBuf> {
        self.model_manager
            .ensure_model(model_id)
            .await
            .map_err(|e| anyhow!("Failed to ensure model {}: {}", model_id, e))
    }

    /// Register a model as loaded on a specific GPU.
    pub async fn register_gpu_model(
        &self,
        gpu_id: usize,
        model_id: &str,
        capability: Capability,
        vram_mb: u64,
    ) -> Result<()> {
        let mut gpus = self.gpus.lock().await;
        let gpu = gpus
            .get_mut(gpu_id)
            .ok_or_else(|| anyhow!("GPU {} not found", gpu_id))?;

        if gpu.free_vram_mb() < vram_mb {
            return Err(anyhow!(
                "Not enough VRAM on GPU {}: need {} MB, have {} MB free",
                gpu_id,
                vram_mb,
                gpu.free_vram_mb()
            ));
        }

        let now = chrono::Utc::now();
        gpu.loaded_models.push(LoadedModel {
            model_id: model_id.to_string(),
            capability,
            vram_mb,
            loaded_at: now,
            last_used: now,
        });
        gpu.used_vram_mb += vram_mb;

        info!(
            "Loaded model {} on GPU {} ({} MB, {} MB free)",
            model_id,
            gpu_id,
            vram_mb,
            gpu.free_vram_mb()
        );
        Ok(())
    }

    /// Register a model as loaded in RAM (CPU inference).
    pub fn register_ram_model(&self, model_id: &str, capability: Capability) {
        let now = chrono::Utc::now();
        self.ram_models.insert(
            model_id.to_string(),
            LoadedModel {
                model_id: model_id.to_string(),
                capability,
                vram_mb: 0,
                loaded_at: now,
                last_used: now,
            },
        );
        info!("Loaded model {} in RAM (CPU inference)", model_id);
    }

    /// Unload a model from a GPU, freeing VRAM.
    pub async fn unload_gpu_model(&self, gpu_id: usize, model_id: &str) -> Result<()> {
        let mut gpus = self.gpus.lock().await;
        let gpu = gpus
            .get_mut(gpu_id)
            .ok_or_else(|| anyhow!("GPU {} not found", gpu_id))?;

        if let Some(pos) = gpu.loaded_models.iter().position(|m| m.model_id == model_id) {
            let model = gpu.loaded_models.remove(pos);
            gpu.used_vram_mb = gpu.used_vram_mb.saturating_sub(model.vram_mb);
            info!(
                "Unloaded model {} from GPU {} (freed {} MB)",
                model_id, gpu_id, model.vram_mb
            );
            Ok(())
        } else {
            Err(anyhow!("Model {} not found on GPU {}", model_id, gpu_id))
        }
    }

    /// Find the best GPU to load a model on. Prefers DynamicPool GPUs.
    pub async fn find_gpu_for(&self, vram_needed: u64) -> Option<usize> {
        let gpus = self.gpus.lock().await;
        // Prefer dynamic pool GPUs first
        gpus.iter()
            .filter(|g| g.role == GpuRole::DynamicPool && g.free_vram_mb() >= vram_needed)
            .map(|g| g.id)
            .next()
            .or_else(|| {
                gpus.iter()
                    .filter(|g| g.free_vram_mb() >= vram_needed)
                    .map(|g| g.id)
                    .next()
            })
    }

    /// Evict LRU model from dynamic pool GPU to make room.
    pub async fn evict_lru_from_pool(&self, vram_needed: u64) -> Result<usize> {
        let mut gpus = self.gpus.lock().await;
        for gpu in gpus.iter_mut().filter(|g| g.role == GpuRole::DynamicPool) {
            if gpu.loaded_models.is_empty() {
                continue;
            }
            // Sort by last_used ascending (oldest first)
            gpu.loaded_models.sort_by_key(|m| m.last_used);
            while gpu.free_vram_mb() < vram_needed && !gpu.loaded_models.is_empty() {
                let evicted = gpu.loaded_models.remove(0);
                gpu.used_vram_mb = gpu.used_vram_mb.saturating_sub(evicted.vram_mb);
                warn!(
                    "Evicted LRU model {} from GPU {} (freed {} MB)",
                    evicted.model_id, gpu.id, evicted.vram_mb
                );
            }
            if gpu.free_vram_mb() >= vram_needed {
                return Ok(gpu.id);
            }
        }
        Err(anyhow!(
            "Cannot free {} MB VRAM on any dynamic pool GPU",
            vram_needed
        ))
    }

    /// Touch a model's last_used timestamp.
    pub async fn touch_model(&self, model_id: &str) {
        let mut gpus = self.gpus.lock().await;
        let now = chrono::Utc::now();
        for gpu in gpus.iter_mut() {
            for model in gpu.loaded_models.iter_mut() {
                if model.model_id == model_id {
                    model.last_used = now;
                    return;
                }
            }
        }
        if let Some(mut entry) = self.ram_models.get_mut(model_id) {
            entry.last_used = now;
        }
    }

    pub fn hardware(&self) -> &HardwareProfile {
        &self.hardware
    }

    pub fn model_manager(&self) -> &Arc<ModelManager> {
        &self.model_manager
    }
}
```

- [ ] **Step 3: Create hardware profiles**

Create `services/signapps-ai/src/models/profiles.rs`:
```rust
use serde::Serialize;

use crate::gateway::{Capability, HardwareTier};

#[derive(Debug, Clone, Serialize)]
pub struct ModelRecommendation {
    pub capability: Capability,
    pub model_id: String,
    pub model_name: String,
    pub vram_mb: u64,
    pub quality_score: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct LoadProfile {
    pub name: String,
    pub tier: HardwareTier,
    pub description: String,
    pub recommendations: Vec<ModelRecommendation>,
    pub total_vram_required_mb: u64,
}

pub fn recommend_models(tier: HardwareTier) -> Vec<ModelRecommendation> {
    match tier {
        HardwareTier::Cpu => vec![
            rec(Capability::TextEmbed, "nomic-embed-text", "Nomic Embed Text", 0, 0.8),
            rec(Capability::Rerank, "bge-reranker-base", "BGE Reranker Base", 0, 0.7),
        ],
        HardwareTier::LowVram => vec![
            rec(Capability::Llm, "llama-3.2-3b-q4", "Llama 3.2 3B Q4", 2500, 0.6),
            rec(Capability::TextEmbed, "nomic-embed-text", "Nomic Embed Text", 250, 0.8),
            rec(Capability::MultimodalEmbed, "siglip-base", "SigLIP Base", 1000, 0.7),
            rec(Capability::Vision, "moondream2", "MoonDream 2", 2000, 0.6),
            rec(Capability::ImageGen, "sd-turbo", "SD Turbo", 2000, 0.5),
            rec(Capability::Rerank, "bge-reranker-base", "BGE Reranker Base", 400, 0.7),
        ],
        HardwareTier::MidVram => vec![
            rec(Capability::Llm, "llama-3.1-8b-q6", "Llama 3.1 8B Q6", 7000, 0.75),
            rec(Capability::TextEmbed, "nomic-embed-text", "Nomic Embed Text", 250, 0.8),
            rec(Capability::MultimodalEmbed, "siglip-large", "SigLIP Large", 1200, 0.85),
            rec(Capability::Vision, "llava-1.6-7b", "LLaVA 1.6 7B", 5000, 0.75),
            rec(Capability::ImageGen, "flux1-schnell", "FLUX.1 Schnell", 8000, 0.8),
            rec(Capability::VideoGen, "cogvideox-2b", "CogVideoX 2B", 6000, 0.6),
            rec(Capability::AudioGen, "stable-audio-open", "Stable Audio Open", 4000, 0.7),
            rec(Capability::Rerank, "bge-reranker-v2-m3", "BGE Reranker v2 M3", 600, 0.85),
        ],
        HardwareTier::HighVram => vec![
            rec(Capability::Llm, "qwen-2.5-32b-q6", "Qwen 2.5 32B Q6", 26000, 0.9),
            rec(Capability::TextEmbed, "nomic-embed-text", "Nomic Embed Text", 250, 0.8),
            rec(Capability::MultimodalEmbed, "siglip-so400m", "SigLIP SO400M", 1500, 0.95),
            rec(Capability::Vision, "internvl2-26b", "InternVL2 26B", 22000, 0.9),
            rec(Capability::ImageGen, "flux1-dev", "FLUX.1 Dev", 24000, 0.95),
            rec(Capability::VideoGen, "cogvideox-5b", "CogVideoX 5B", 18000, 0.65),
            rec(Capability::AudioGen, "musicgen-large", "MusicGen Large", 14000, 0.8),
            rec(Capability::Rerank, "bge-reranker-v2-gemma", "BGE Reranker v2 Gemma", 6000, 0.95),
            rec(Capability::DocParse, "paddleocr-onnx", "PaddleOCR ONNX", 500, 0.8),
        ],
        HardwareTier::UltraVram => vec![
            rec(Capability::Llm, "qwen-2.5-72b-q6", "Qwen 2.5 72B Q6", 50000, 0.98),
            rec(Capability::TextEmbed, "nomic-embed-text", "Nomic Embed Text", 250, 0.8),
            rec(Capability::MultimodalEmbed, "siglip-so400m", "SigLIP SO400M", 1500, 0.95),
            rec(Capability::Vision, "qwen2-vl-72b-q4", "Qwen2-VL 72B Q4", 40000, 0.98),
            rec(Capability::ImageGen, "flux1-dev", "FLUX.1 Dev", 24000, 0.95),
            rec(Capability::VideoGen, "cogvideox-5b", "CogVideoX 5B", 18000, 0.65),
            rec(Capability::VideoUnderstand, "qwen2-vl-72b-q4", "Qwen2-VL 72B", 40000, 0.98),
            rec(Capability::AudioGen, "musicgen-large", "MusicGen Large", 14000, 0.8),
            rec(Capability::Rerank, "bge-reranker-v2-gemma", "BGE Reranker v2 Gemma", 6000, 0.95),
            rec(Capability::DocParse, "paddleocr-onnx", "PaddleOCR ONNX", 500, 0.8),
        ],
    }
}

pub fn build_profile(tier: HardwareTier) -> LoadProfile {
    let recommendations = recommend_models(tier);
    let total_vram = recommendations.iter().map(|r| r.vram_mb).sum();
    LoadProfile {
        name: format!("{:?}", tier),
        tier,
        description: match tier {
            HardwareTier::Cpu => "CPU-only: text embeddings and basic reranking".into(),
            HardwareTier::LowVram => "Compact models for ≤8 GB VRAM".into(),
            HardwareTier::MidVram => "Balanced quality for 8-16 GB VRAM".into(),
            HardwareTier::HighVram => "High quality for 16-24 GB VRAM".into(),
            HardwareTier::UltraVram => "Maximum quality for 24+ GB / multi-GPU".into(),
        },
        recommendations,
        total_vram_required_mb: total_vram,
    }
}

fn rec(cap: Capability, id: &str, name: &str, vram: u64, quality: f32) -> ModelRecommendation {
    ModelRecommendation {
        capability: cap,
        model_id: id.to_string(),
        model_name: name.to_string(),
        vram_mb: vram,
        quality_score: quality,
    }
}
```

- [ ] **Step 4: Register models module in main.rs**

Add `mod models;` in `services/signapps-ai/src/main.rs` (rename the existing `models` handler import if needed — the existing `models.rs` handler is in `handlers/models.rs`, not a top-level module).

Note: There may be a conflict if `mod models;` already exists for something else. Check first. The existing code uses `handlers::models` not a top-level `models` module. If no conflict, add `mod models;`. If conflict, rename to `mod model_orchestration;` and update all references.

- [ ] **Step 5: Verify compilation**

Run: `rtk cargo check -p signapps-ai`

- [ ] **Step 6: Commit**

```bash
rtk git add services/signapps-ai/src/models/
rtk git commit -m "feat(ai): add ModelOrchestrator with multi-GPU VRAM management and hardware profiles"
```

---

### Task 1.4: Implement Gateway Router

**Files:**
- Modify: `services/signapps-ai/src/gateway/router.rs`

- [ ] **Step 1: Implement GatewayRouter**

Replace `services/signapps-ai/src/gateway/router.rs`:
```rust
use std::collections::HashMap;
use std::sync::Arc;

use anyhow::{anyhow, Result};
use tokio::sync::RwLock;
use tracing::info;

use crate::gateway::capability::{BackendInfo, BackendType, Capability, CapabilityInfo};
use crate::gateway::quality_advisor::{QualityAdvice, QualityAdvisor};
use crate::models::ModelOrchestrator;
use crate::workers::traits::AiWorker;

pub struct GatewayRouter {
    workers: RwLock<HashMap<Capability, Vec<Arc<dyn AiWorker>>>>,
    orchestrator: Arc<ModelOrchestrator>,
    advisor: QualityAdvisor,
}

impl GatewayRouter {
    pub fn new(orchestrator: Arc<ModelOrchestrator>) -> Self {
        Self {
            workers: RwLock::new(HashMap::new()),
            orchestrator,
            advisor: QualityAdvisor::new(),
        }
    }

    /// Register a worker for a capability.
    pub async fn register(&self, worker: Arc<dyn AiWorker>) {
        let cap = worker.capability();
        let mut workers = self.workers.write().await;
        workers.entry(cap).or_insert_with(Vec::new).push(worker);
        info!("Registered worker for {:?}", cap);
    }

    /// Route to the best available worker for a capability.
    /// Priority: Native (if loaded & healthy) > Http > Cloud
    /// Exception: if cloud quality >> local quality (>0.3 gap), prefer cloud.
    pub async fn route(&self, cap: Capability) -> Result<Arc<dyn AiWorker>> {
        let workers = self.workers.read().await;
        let candidates = workers
            .get(&cap)
            .ok_or_else(|| anyhow!("No workers registered for {:?}", cap))?;

        if candidates.is_empty() {
            return Err(anyhow!("No workers available for {:?}", cap));
        }

        // Check health and sort by preference
        let mut healthy: Vec<&Arc<dyn AiWorker>> = Vec::new();
        for w in candidates {
            if w.health_check().await {
                healthy.push(w);
            }
        }

        if healthy.is_empty() {
            return Err(anyhow!("All workers for {:?} are unhealthy", cap));
        }

        // Sort: Native first, then Http, then Cloud — unless cloud is much better
        healthy.sort_by(|a, b| {
            let priority = |w: &Arc<dyn AiWorker>| -> u8 {
                match w.backend_type() {
                    BackendType::Native => 0,
                    BackendType::Http { .. } => 1,
                    BackendType::Cloud { .. } => 2,
                }
            };
            priority(a).cmp(&priority(b))
        });

        Ok(healthy[0].clone())
    }

    /// Get quality advice for a capability.
    pub async fn quality_advice(&self, cap: Capability) -> Option<QualityAdvice> {
        let workers = self.workers.read().await;
        let candidates = workers.get(&cap)?;
        self.advisor.compare(cap, candidates)
    }

    /// List all capabilities and their status.
    pub async fn list_capabilities(&self) -> Vec<CapabilityInfo> {
        let workers = self.workers.read().await;
        let mut result = Vec::new();

        for cap in Capability::all() {
            let cap_workers = workers.get(cap);
            let available = cap_workers.map_or(false, |w| !w.is_empty());

            let mut backends = Vec::new();
            let mut active_backend = String::from("none");
            let mut local_quality = 0.0_f32;
            let mut cloud_quality: Option<f32> = None;
            let mut gpu_loaded = false;

            if let Some(ws) = cap_workers {
                for w in ws {
                    let bt = w.backend_type();
                    let qs = w.quality_score();
                    backends.push(BackendInfo {
                        name: format!("{:?}", bt),
                        backend_type: bt.clone(),
                        quality_score: qs,
                        available: true,
                    });
                    match &bt {
                        BackendType::Native => {
                            local_quality = local_quality.max(qs);
                            if w.is_loaded() {
                                gpu_loaded = true;
                            }
                        }
                        BackendType::Http { .. } => {
                            local_quality = local_quality.max(qs);
                        }
                        BackendType::Cloud { .. } => {
                            cloud_quality = Some(cloud_quality.unwrap_or(0.0).max(qs));
                        }
                    }
                }
                if let Some(first) = ws.first() {
                    active_backend = format!("{:?}", first.backend_type());
                }
            }

            let upgrade_recommended = cloud_quality
                .map_or(false, |cq| cq - local_quality > 0.3);

            result.push(CapabilityInfo {
                capability: *cap,
                available,
                backends,
                active_backend,
                local_quality,
                cloud_quality,
                upgrade_recommended,
                gpu_loaded,
                vram_required_mb: cap_workers
                    .and_then(|ws| ws.first())
                    .map_or(0, |w| w.required_vram_mb()),
            });
        }

        result
    }

    pub fn orchestrator(&self) -> &Arc<ModelOrchestrator> {
        &self.orchestrator
    }
}
```

- [ ] **Step 2: Implement QualityAdvisor**

Replace `services/signapps-ai/src/gateway/quality_advisor.rs`:
```rust
use std::sync::Arc;

use serde::Serialize;

use crate::gateway::capability::{BackendType, Capability};
use crate::workers::traits::AiWorker;

#[derive(Debug, Clone, Serialize)]
pub struct QualityAdvice {
    pub capability: Capability,
    pub local_quality: f32,
    pub cloud_quality: f32,
    pub gap: f32,
    pub recommendation: String,
    pub cloud_provider: Option<String>,
}

pub struct QualityAdvisor;

impl QualityAdvisor {
    pub fn new() -> Self {
        Self
    }

    pub fn compare(
        &self,
        cap: Capability,
        workers: &[Arc<dyn AiWorker>],
    ) -> Option<QualityAdvice> {
        let mut best_local: f32 = 0.0;
        let mut best_cloud: f32 = 0.0;
        let mut cloud_provider: Option<String> = None;

        for w in workers {
            let qs = w.quality_score();
            match w.backend_type() {
                BackendType::Cloud { provider } => {
                    if qs > best_cloud {
                        best_cloud = qs;
                        cloud_provider = Some(provider);
                    }
                }
                _ => {
                    best_local = best_local.max(qs);
                }
            }
        }

        if best_cloud <= 0.0 && best_local <= 0.0 {
            return None;
        }

        let gap = best_cloud - best_local;
        let recommendation = if gap > 0.3 {
            format!(
                "Cloud recommended for {:?}: significant quality gap ({:.0}%). Consider {} for best results.",
                cap,
                gap * 100.0,
                cloud_provider.as_deref().unwrap_or("cloud provider"),
            )
        } else if gap > 0.1 {
            format!(
                "Local quality is good for {:?}. Cloud is slightly better ({:.0}% gap).",
                cap,
                gap * 100.0,
            )
        } else {
            format!("Local quality is excellent for {:?}. No cloud upgrade needed.", cap)
        };

        Some(QualityAdvice {
            capability: cap,
            local_quality: best_local,
            cloud_quality: best_cloud,
            gap,
            recommendation,
            cloud_provider,
        })
    }
}
```

- [ ] **Step 3: Verify compilation**

Run: `rtk cargo check -p signapps-ai`

- [ ] **Step 4: Commit**

```bash
rtk git add services/signapps-ai/src/gateway/
rtk git commit -m "feat(ai): implement GatewayRouter with intelligent routing and QualityAdvisor"
```

---

### Task 1.5: Add gateway capability and GPU status handlers

**Files:**
- Create: `services/signapps-ai/src/handlers/capabilities.rs`
- Create: `services/signapps-ai/src/handlers/gpu_status.rs`
- Modify: `services/signapps-ai/src/handlers/mod.rs`
- Modify: `services/signapps-ai/src/main.rs`

- [ ] **Step 1: Create capabilities handler**

Create `services/signapps-ai/src/handlers/capabilities.rs`:
```rust
use axum::extract::State;
use axum::response::Json;
use axum::extract::Path;

use crate::gateway::capability::CapabilityInfo;
use crate::gateway::quality_advisor::QualityAdvice;
use crate::gateway::Capability;
use crate::AppState;

pub async fn list_capabilities(
    State(state): State<AppState>,
) -> Json<Vec<CapabilityInfo>> {
    let caps = state.gateway.list_capabilities().await;
    Json(caps)
}

pub async fn get_capability_advice(
    State(state): State<AppState>,
    Path(cap_name): Path<String>,
) -> Result<Json<QualityAdvice>, signapps_common::AppError> {
    let cap = parse_capability(&cap_name)?;
    let advice = state
        .gateway
        .quality_advice(cap)
        .await
        .ok_or_else(|| signapps_common::AppError::not_found("No data for this capability"))?;
    Ok(Json(advice))
}

fn parse_capability(s: &str) -> Result<Capability, signapps_common::AppError> {
    match s {
        "llm" => Ok(Capability::Llm),
        "vision" => Ok(Capability::Vision),
        "image_gen" => Ok(Capability::ImageGen),
        "video_gen" => Ok(Capability::VideoGen),
        "video_understand" => Ok(Capability::VideoUnderstand),
        "audio_gen" => Ok(Capability::AudioGen),
        "rerank" => Ok(Capability::Rerank),
        "doc_parse" => Ok(Capability::DocParse),
        "text_embed" => Ok(Capability::TextEmbed),
        "multimodal_embed" => Ok(Capability::MultimodalEmbed),
        _ => Err(signapps_common::AppError::bad_request(
            &format!("Unknown capability: {}", s),
        )),
    }
}
```

- [ ] **Step 2: Create GPU status handler**

Create `services/signapps-ai/src/handlers/gpu_status.rs`:
```rust
use axum::extract::State;
use axum::response::Json;
use serde::Serialize;

use crate::gateway::HardwareTier;
use crate::models::orchestrator::GpuState;
use crate::models::profiles::{build_profile, LoadProfile};
use crate::AppState;

#[derive(Debug, Serialize)]
pub struct GpuStatusResponse {
    pub gpus: Vec<GpuState>,
    pub total_vram_mb: u64,
    pub free_vram_mb: u64,
    pub tier: HardwareTier,
}

pub async fn get_gpu_status(
    State(state): State<AppState>,
) -> Json<GpuStatusResponse> {
    let gpus = state.gateway.orchestrator().gpu_status().await;
    let total: u64 = gpus.iter().map(|g| g.total_vram_mb).sum();
    let free: u64 = gpus.iter().map(|g| g.free_vram_mb()).sum();
    let tier = HardwareTier::from_vram_mb(total);

    Json(GpuStatusResponse {
        gpus,
        total_vram_mb: total,
        free_vram_mb: free,
        tier,
    })
}

pub async fn list_profiles() -> Json<Vec<LoadProfile>> {
    let profiles = vec![
        build_profile(HardwareTier::Cpu),
        build_profile(HardwareTier::LowVram),
        build_profile(HardwareTier::MidVram),
        build_profile(HardwareTier::HighVram),
        build_profile(HardwareTier::UltraVram),
    ];
    Json(profiles)
}

pub async fn get_recommended_models(
    State(state): State<AppState>,
) -> Json<LoadProfile> {
    let total_vram = state.gateway.orchestrator().hardware().total_vram_mb;
    let tier = HardwareTier::from_vram_mb(total_vram);
    Json(build_profile(tier))
}
```

- [ ] **Step 3: Add modules to handlers/mod.rs**

Add to `services/signapps-ai/src/handlers/mod.rs`:
```rust
pub mod capabilities;
pub mod gpu_status;
```

- [ ] **Step 4: Add GatewayRouter to AppState and register routes**

In `services/signapps-ai/src/main.rs`:

Add to AppState:
```rust
pub gateway: Arc<GatewayRouter>,
```

In the initialization section (after creating model_manager and hardware), create the gateway:
```rust
let orchestrator = Arc::new(ModelOrchestrator::new(
    model_manager.clone().unwrap_or_else(|| Arc::new(ModelManager::new(None))),
    hardware.clone().unwrap_or_else(HardwareProfile::default),
));
let gateway = Arc::new(GatewayRouter::new(orchestrator));
```

Add new routes under the ai router:
```rust
.route("/ai/capabilities", get(handlers::capabilities::list_capabilities))
.route("/ai/capabilities/{cap}", get(handlers::capabilities::get_capability_advice))
.route("/ai/gpu/status", get(handlers::gpu_status::get_gpu_status))
.route("/ai/gpu/profiles", get(handlers::gpu_status::list_profiles))
.route("/ai/models/recommended", get(handlers::gpu_status::get_recommended_models))
```

- [ ] **Step 5: Verify compilation**

Run: `rtk cargo check -p signapps-ai`

Fix any import issues. The exact integration depends on how AppState is currently structured — adapt the field addition to match the existing pattern.

- [ ] **Step 6: Commit**

```bash
rtk git add services/signapps-ai/src/handlers/capabilities.rs services/signapps-ai/src/handlers/gpu_status.rs services/signapps-ai/src/handlers/mod.rs services/signapps-ai/src/main.rs
rtk git commit -m "feat(ai): add capability listing and GPU status endpoints"
```

---

## Phase 2: SQL Migration + DB Layer

### Task 2.1: Create multimodal gateway migration

**Files:**
- Create: `migrations/059_ai_multimodal_gateway.sql`

- [ ] **Step 1: Write migration**

Create `migrations/059_ai_multimodal_gateway.sql`:
```sql
-- Multimodal vectors (SigLIP 1024-dim space)
CREATE TABLE IF NOT EXISTS ai.multimodal_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    media_type VARCHAR(32) NOT NULL,
    content TEXT,
    filename VARCHAR(512) NOT NULL,
    path TEXT NOT NULL,
    mime_type VARCHAR(128),
    collection VARCHAR(256) NOT NULL DEFAULT 'default'
        REFERENCES ai.collections(name) ON DELETE CASCADE,
    embedding vector(1024),
    metadata JSONB DEFAULT '{}'::jsonb,
    security_tags JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, chunk_index, media_type)
);

CREATE INDEX IF NOT EXISTS idx_mm_vectors_embedding
    ON ai.multimodal_vectors USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_mm_vectors_collection ON ai.multimodal_vectors(collection);
CREATE INDEX IF NOT EXISTS idx_mm_vectors_media_type ON ai.multimodal_vectors(media_type);
CREATE INDEX IF NOT EXISTS idx_mm_vectors_metadata ON ai.multimodal_vectors USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_mm_vectors_document_id ON ai.multimodal_vectors(document_id);

-- Conversations
CREATE TABLE IF NOT EXISTS ai.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(512),
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON ai.conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai.conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai.conversations(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,
    media JSONB DEFAULT '[]'::jsonb,
    model VARCHAR(256),
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conv_msgs_conv ON ai.conversation_messages(conversation_id, created_at);

-- Generated media tracking
CREATE TABLE IF NOT EXISTS ai.generated_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_type VARCHAR(32) NOT NULL,
    prompt TEXT NOT NULL,
    model_used VARCHAR(256) NOT NULL,
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    metadata JSONB DEFAULT '{}'::jsonb,
    indexed BOOLEAN DEFAULT false,
    conversation_id UUID REFERENCES ai.conversations(id) ON DELETE SET NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generated_media_user ON ai.generated_media(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_media_indexed ON ai.generated_media(indexed) WHERE indexed = false;

-- Model cache registry
CREATE TABLE IF NOT EXISTS ai.model_registry (
    id VARCHAR(256) PRIMARY KEY,
    model_type VARCHAR(64) NOT NULL,
    source VARCHAR(512) NOT NULL,
    local_path TEXT,
    size_bytes BIGINT,
    status VARCHAR(32) NOT NULL DEFAULT 'available',
    recommended_vram_mb INTEGER,
    hardware_tier VARCHAR(32),
    downloaded_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);
```

- [ ] **Step 2: Verify migration syntax**

Run: `rtk cargo run -p signapps-identity` (which triggers migrations), or manually check SQL syntax.

- [ ] **Step 3: Commit**

```bash
rtk git add migrations/059_ai_multimodal_gateway.sql
rtk git commit -m "feat(db): add multimodal vectors, conversations, generated media, and model registry tables"
```

---

### Task 2.2: Add MultimodalVectorRepository to signapps-db

**Files:**
- Create: `crates/signapps-db/src/models/multimodal_vector.rs`
- Create: `crates/signapps-db/src/repositories/multimodal_vector_repository.rs`
- Create: `crates/signapps-db/src/models/conversation.rs`
- Create: `crates/signapps-db/src/repositories/conversation_repository.rs`
- Create: `crates/signapps-db/src/models/generated_media.rs`
- Create: `crates/signapps-db/src/repositories/generated_media_repository.rs`
- Modify: `crates/signapps-db/src/models/mod.rs`
- Modify: `crates/signapps-db/src/repositories/mod.rs`

- [ ] **Step 1: Create multimodal vector models**

Create `crates/signapps-db/src/models/multimodal_vector.rs`:
```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultimodalVector {
    pub id: Uuid,
    pub document_id: Uuid,
    pub chunk_index: i32,
    pub media_type: String,
    pub content: Option<String>,
    pub filename: String,
    pub path: String,
    pub mime_type: Option<String>,
    pub collection: String,
    pub metadata: Option<serde_json::Value>,
    pub security_tags: Option<serde_json::Value>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MultimodalSearchResult {
    pub id: Uuid,
    pub document_id: Uuid,
    pub chunk_index: i32,
    pub media_type: String,
    pub content: Option<String>,
    pub filename: String,
    pub path: String,
    pub mime_type: Option<String>,
    pub score: f32,
    pub metadata: Option<serde_json::Value>,
    pub security_tags: Option<serde_json::Value>,
}

#[derive(Debug, Clone)]
pub struct MultimodalChunkInput {
    pub id: Uuid,
    pub document_id: Uuid,
    pub chunk_index: i32,
    pub media_type: String,
    pub content: Option<String>,
    pub filename: String,
    pub path: String,
    pub mime_type: Option<String>,
    pub collection: String,
    pub metadata: Option<serde_json::Value>,
    pub security_tags: Option<serde_json::Value>,
}
```

- [ ] **Step 2: Create multimodal vector repository**

Create `crates/signapps-db/src/repositories/multimodal_vector_repository.rs`:
```rust
use anyhow::Result;
use sqlx::Row;
use uuid::Uuid;

use crate::models::multimodal_vector::{MultimodalChunkInput, MultimodalSearchResult};
use crate::DatabasePool;

pub struct MultimodalVectorRepository;

impl MultimodalVectorRepository {
    pub async fn upsert_chunks(
        pool: &DatabasePool,
        chunks: &[MultimodalChunkInput],
        embeddings: &[Vec<f32>],
    ) -> Result<()> {
        for (chunk, embedding) in chunks.iter().zip(embeddings.iter()) {
            let embedding_str = format!(
                "[{}]",
                embedding.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(",")
            );
            sqlx::query(
                r#"
                INSERT INTO ai.multimodal_vectors
                    (id, document_id, chunk_index, media_type, content, filename, path,
                     mime_type, collection, embedding, metadata, security_tags)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, $11, $12)
                ON CONFLICT (document_id, chunk_index, media_type) DO UPDATE SET
                    content = EXCLUDED.content,
                    filename = EXCLUDED.filename,
                    path = EXCLUDED.path,
                    mime_type = EXCLUDED.mime_type,
                    collection = EXCLUDED.collection,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata,
                    security_tags = EXCLUDED.security_tags
                "#,
            )
            .bind(chunk.id)
            .bind(chunk.document_id)
            .bind(chunk.chunk_index)
            .bind(&chunk.media_type)
            .bind(&chunk.content)
            .bind(&chunk.filename)
            .bind(&chunk.path)
            .bind(&chunk.mime_type)
            .bind(&chunk.collection)
            .bind(&embedding_str)
            .bind(&chunk.metadata)
            .bind(&chunk.security_tags)
            .execute(pool.as_ref())
            .await?;
        }
        Ok(())
    }

    pub async fn search(
        pool: &DatabasePool,
        query_vector: &[f32],
        limit: i64,
        score_threshold: Option<f32>,
        collections: Option<&[String]>,
        media_types: Option<&[String]>,
    ) -> Result<Vec<MultimodalSearchResult>> {
        let embedding_str = format!(
            "[{}]",
            query_vector.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(",")
        );
        let threshold = score_threshold.unwrap_or(0.3);

        let mut query = String::from(
            r#"
            SELECT id, document_id, chunk_index, media_type, content, filename, path,
                   mime_type, metadata, security_tags,
                   1 - (embedding <=> $1::vector) AS score
            FROM ai.multimodal_vectors
            WHERE 1 - (embedding <=> $1::vector) >= $2
            "#,
        );

        if let Some(cols) = collections {
            if !cols.is_empty() {
                let cols_str = cols.iter().map(|c| format!("'{}'", c.replace('\'', "''"))).collect::<Vec<_>>().join(",");
                query.push_str(&format!(" AND collection IN ({})", cols_str));
            }
        }

        if let Some(types) = media_types {
            if !types.is_empty() {
                let types_str = types.iter().map(|t| format!("'{}'", t.replace('\'', "''"))).collect::<Vec<_>>().join(",");
                query.push_str(&format!(" AND media_type IN ({})", types_str));
            }
        }

        query.push_str(" ORDER BY score DESC LIMIT $3");

        let rows = sqlx::query(&query)
            .bind(&embedding_str)
            .bind(threshold)
            .bind(limit)
            .fetch_all(pool.as_ref())
            .await?;

        let results = rows
            .iter()
            .map(|row| MultimodalSearchResult {
                id: row.get("id"),
                document_id: row.get("document_id"),
                chunk_index: row.get("chunk_index"),
                media_type: row.get("media_type"),
                content: row.get("content"),
                filename: row.get("filename"),
                path: row.get("path"),
                mime_type: row.get("mime_type"),
                score: row.get("score"),
                metadata: row.get("metadata"),
                security_tags: row.get("security_tags"),
            })
            .collect();

        Ok(results)
    }

    pub async fn delete_by_document(pool: &DatabasePool, document_id: Uuid) -> Result<u64> {
        let result = sqlx::query("DELETE FROM ai.multimodal_vectors WHERE document_id = $1")
            .bind(document_id)
            .execute(pool.as_ref())
            .await?;
        Ok(result.rows_affected())
    }
}
```

- [ ] **Step 3: Create conversation models and repository**

Create `crates/signapps-db/src/models/conversation.rs`:
```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: Option<String>,
    pub summary: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationMessage {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub role: String,
    pub content: String,
    pub sources: serde_json::Value,
    pub media: serde_json::Value,
    pub model: Option<String>,
    pub tokens_used: Option<i32>,
    pub created_at: DateTime<Utc>,
}
```

Create `crates/signapps-db/src/repositories/conversation_repository.rs`:
```rust
use anyhow::Result;
use sqlx::Row;
use uuid::Uuid;

use crate::models::conversation::{Conversation, ConversationMessage};
use crate::DatabasePool;

pub struct ConversationRepository;

impl ConversationRepository {
    pub async fn create(
        pool: &DatabasePool,
        user_id: Uuid,
        title: Option<&str>,
    ) -> Result<Conversation> {
        let row = sqlx::query(
            r#"
            INSERT INTO ai.conversations (user_id, title)
            VALUES ($1, $2)
            RETURNING id, user_id, title, summary, created_at, updated_at
            "#,
        )
        .bind(user_id)
        .bind(title)
        .fetch_one(pool.as_ref())
        .await?;

        Ok(Conversation {
            id: row.get("id"),
            user_id: row.get("user_id"),
            title: row.get("title"),
            summary: row.get("summary"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    pub async fn get(pool: &DatabasePool, id: Uuid) -> Result<Option<Conversation>> {
        let row = sqlx::query(
            "SELECT id, user_id, title, summary, created_at, updated_at FROM ai.conversations WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(pool.as_ref())
        .await?;

        Ok(row.map(|r| Conversation {
            id: r.get("id"),
            user_id: r.get("user_id"),
            title: r.get("title"),
            summary: r.get("summary"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        }))
    }

    pub async fn list_by_user(
        pool: &DatabasePool,
        user_id: Uuid,
        limit: i64,
    ) -> Result<Vec<Conversation>> {
        let rows = sqlx::query(
            r#"
            SELECT id, user_id, title, summary, created_at, updated_at
            FROM ai.conversations
            WHERE user_id = $1
            ORDER BY updated_at DESC
            LIMIT $2
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(pool.as_ref())
        .await?;

        Ok(rows
            .iter()
            .map(|r| Conversation {
                id: r.get("id"),
                user_id: r.get("user_id"),
                title: r.get("title"),
                summary: r.get("summary"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            })
            .collect())
    }

    pub async fn delete(pool: &DatabasePool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM ai.conversations WHERE id = $1")
            .bind(id)
            .execute(pool.as_ref())
            .await?;
        Ok(())
    }

    pub async fn add_message(
        pool: &DatabasePool,
        conversation_id: Uuid,
        role: &str,
        content: &str,
        sources: &serde_json::Value,
        media: &serde_json::Value,
        model: Option<&str>,
        tokens_used: Option<i32>,
    ) -> Result<ConversationMessage> {
        let row = sqlx::query(
            r#"
            INSERT INTO ai.conversation_messages
                (conversation_id, role, content, sources, media, model, tokens_used)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, conversation_id, role, content, sources, media, model, tokens_used, created_at
            "#,
        )
        .bind(conversation_id)
        .bind(role)
        .bind(content)
        .bind(sources)
        .bind(media)
        .bind(model)
        .bind(tokens_used)
        .fetch_one(pool.as_ref())
        .await?;

        // Update conversation timestamp
        sqlx::query("UPDATE ai.conversations SET updated_at = NOW() WHERE id = $1")
            .bind(conversation_id)
            .execute(pool.as_ref())
            .await?;

        Ok(ConversationMessage {
            id: row.get("id"),
            conversation_id: row.get("conversation_id"),
            role: row.get("role"),
            content: row.get("content"),
            sources: row.get("sources"),
            media: row.get("media"),
            model: row.get("model"),
            tokens_used: row.get("tokens_used"),
            created_at: row.get("created_at"),
        })
    }

    pub async fn get_messages(
        pool: &DatabasePool,
        conversation_id: Uuid,
        limit: i64,
    ) -> Result<Vec<ConversationMessage>> {
        let rows = sqlx::query(
            r#"
            SELECT id, conversation_id, role, content, sources, media, model, tokens_used, created_at
            FROM ai.conversation_messages
            WHERE conversation_id = $1
            ORDER BY created_at ASC
            LIMIT $2
            "#,
        )
        .bind(conversation_id)
        .bind(limit)
        .fetch_all(pool.as_ref())
        .await?;

        Ok(rows
            .iter()
            .map(|r| ConversationMessage {
                id: r.get("id"),
                conversation_id: r.get("conversation_id"),
                role: r.get("role"),
                content: r.get("content"),
                sources: r.get("sources"),
                media: r.get("media"),
                model: r.get("model"),
                tokens_used: r.get("tokens_used"),
                created_at: r.get("created_at"),
            })
            .collect())
    }

    pub async fn update_summary(
        pool: &DatabasePool,
        conversation_id: Uuid,
        summary: &str,
    ) -> Result<()> {
        sqlx::query("UPDATE ai.conversations SET summary = $1 WHERE id = $2")
            .bind(summary)
            .bind(conversation_id)
            .execute(pool.as_ref())
            .await?;
        Ok(())
    }
}
```

- [ ] **Step 4: Create generated_media models and repository**

Create `crates/signapps-db/src/models/generated_media.rs`:
```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedMedia {
    pub id: Uuid,
    pub media_type: String,
    pub prompt: String,
    pub model_used: String,
    pub storage_path: String,
    pub file_size_bytes: Option<i64>,
    pub metadata: Option<serde_json::Value>,
    pub indexed: bool,
    pub conversation_id: Option<Uuid>,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
}
```

Create `crates/signapps-db/src/repositories/generated_media_repository.rs`:
```rust
use anyhow::Result;
use sqlx::Row;
use uuid::Uuid;

use crate::models::generated_media::GeneratedMedia;
use crate::DatabasePool;

pub struct GeneratedMediaRepository;

impl GeneratedMediaRepository {
    pub async fn create(
        pool: &DatabasePool,
        media_type: &str,
        prompt: &str,
        model_used: &str,
        storage_path: &str,
        file_size_bytes: Option<i64>,
        metadata: Option<&serde_json::Value>,
        conversation_id: Option<Uuid>,
        user_id: Uuid,
    ) -> Result<GeneratedMedia> {
        let row = sqlx::query(
            r#"
            INSERT INTO ai.generated_media
                (media_type, prompt, model_used, storage_path, file_size_bytes, metadata, conversation_id, user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, media_type, prompt, model_used, storage_path, file_size_bytes,
                      metadata, indexed, conversation_id, user_id, created_at
            "#,
        )
        .bind(media_type)
        .bind(prompt)
        .bind(model_used)
        .bind(storage_path)
        .bind(file_size_bytes)
        .bind(metadata)
        .bind(conversation_id)
        .bind(user_id)
        .fetch_one(pool.as_ref())
        .await?;

        Ok(GeneratedMedia {
            id: row.get("id"),
            media_type: row.get("media_type"),
            prompt: row.get("prompt"),
            model_used: row.get("model_used"),
            storage_path: row.get("storage_path"),
            file_size_bytes: row.get("file_size_bytes"),
            metadata: row.get("metadata"),
            indexed: row.get("indexed"),
            conversation_id: row.get("conversation_id"),
            user_id: row.get("user_id"),
            created_at: row.get("created_at"),
        })
    }

    pub async fn mark_indexed(pool: &DatabasePool, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE ai.generated_media SET indexed = true WHERE id = $1")
            .bind(id)
            .execute(pool.as_ref())
            .await?;
        Ok(())
    }

    pub async fn list_unindexed(pool: &DatabasePool, limit: i64) -> Result<Vec<GeneratedMedia>> {
        let rows = sqlx::query(
            r#"
            SELECT id, media_type, prompt, model_used, storage_path, file_size_bytes,
                   metadata, indexed, conversation_id, user_id, created_at
            FROM ai.generated_media
            WHERE indexed = false
            ORDER BY created_at ASC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(pool.as_ref())
        .await?;

        Ok(rows
            .iter()
            .map(|r| GeneratedMedia {
                id: r.get("id"),
                media_type: r.get("media_type"),
                prompt: r.get("prompt"),
                model_used: r.get("model_used"),
                storage_path: r.get("storage_path"),
                file_size_bytes: r.get("file_size_bytes"),
                metadata: r.get("metadata"),
                indexed: r.get("indexed"),
                conversation_id: r.get("conversation_id"),
                user_id: r.get("user_id"),
                created_at: r.get("created_at"),
            })
            .collect())
    }
}
```

- [ ] **Step 5: Register new modules in signapps-db**

Add to `crates/signapps-db/src/models/mod.rs`:
```rust
pub mod multimodal_vector;
pub mod conversation;
pub mod generated_media;
```

Add to `crates/signapps-db/src/repositories/mod.rs`:
```rust
pub mod multimodal_vector_repository;
pub mod conversation_repository;
pub mod generated_media_repository;
```

- [ ] **Step 6: Verify compilation**

Run: `rtk cargo check --workspace`

- [ ] **Step 7: Commit**

```bash
rtk git add crates/signapps-db/src/models/ crates/signapps-db/src/repositories/ migrations/059_ai_multimodal_gateway.sql
rtk git commit -m "feat(db): add multimodal vector, conversation, and generated media repositories"
```

---

## Phase 3–12: Remaining Phases

> **Note for implementor:** Phases 3-12 follow the same pattern established in Phases 1-2. Each phase adds workers, handlers, and frontend components following the trait-based architecture. The detailed tasks below provide the structure; the implementing agent should follow the existing patterns.

### Phase 3: Reranker + Multimodal Embeddings Workers (First Workers)

**Task 3.1:** Create reranker worker — `services/signapps-ai/src/workers/reranker/mod.rs` with `NativeReranker` (ONNX bge-reranker), `HttpReranker`, `CloudReranker` (Cohere). Register in gateway.

**Task 3.2:** Create multimodal embeddings worker — `services/signapps-ai/src/workers/embeddings_mm/mod.rs` with `NativeSigLIP` (ONNX Runtime), `HttpEmbeddings`, `CloudEmbeddings` (OpenAI CLIP). Register in gateway.

**Task 3.3:** Add `ort` dependency to Cargo.toml behind `native-reranker` and `native-embedmm` features.

**Task 3.4:** Add reranker endpoint `POST /api/v1/ai/rerank` and embeddings endpoint.

---

### Phase 4: RAG Multimodal

**Task 4.1:** Create `services/signapps-ai/src/rag/multimodal_indexer.rs` — `MultimodalIndexer` struct that auto-detects media type and indexes into the appropriate space (text 384d and/or multimodal 1024d). Uses `VisionWorker` for image descriptions, `SttBackend` for audio transcription.

**Task 4.2:** Create `services/signapps-ai/src/rag/multimodal_search.rs` — `MultimodalSearch` struct with RRF fusion of text + multimodal spaces. Optional reranking via `RerankerWorker`.

**Task 4.3:** Create `services/signapps-ai/src/rag/circular_pipeline.rs` — Background task that watches `ai.generated_media` for unindexed entries and auto-indexes them via `MultimodalIndexer`.

**Task 4.4:** Add `POST /api/v1/ai/search/image` endpoint (search by uploaded image).

**Task 4.5:** Enrich existing `GET /api/v1/ai/search` to use `MultimodalSearch` with fusion when multimodal workers are available, falling back to text-only search otherwise.

---

### Phase 5: Conversation Memory

**Task 5.1:** Create `services/signapps-ai/src/memory/mod.rs`, `conversation.rs`, `context_builder.rs`, `summarizer.rs`.

**Task 5.2:** Implement `ConversationMemory` — wraps `ConversationRepository`, manages get_or_create, add_message, get_context (last N messages), summarize_if_needed (calls LLM to summarize when >20 messages).

**Task 5.3:** Add conversation endpoints: `GET /api/v1/ai/conversations`, `GET /api/v1/ai/conversations/:id`, `DELETE /api/v1/ai/conversations/:id`.

**Task 5.4:** Wire conversation memory into chat handler — `conversation_id` in `ChatRequest` triggers context loading.

---

### Phase 6: Vision + DocParse Workers

**Task 6.1:** Create `services/signapps-ai/src/workers/vision/mod.rs` with `NativeVision` (llama.cpp multimodal GGUF — InternVL2/LLaVA), `HttpVision` (vLLM/Ollama multimodal), `CloudVision` (GPT-4o Vision, Claude Vision).

**Task 6.2:** Create `services/signapps-ai/src/workers/docparse/mod.rs` with `NativeDocParse` (ocrs existing + PaddleOCR ONNX), `CloudDocParse` (Azure Doc Intelligence).

**Task 6.3:** Add vision endpoints: `POST /api/v1/ai/vision/describe`, `POST /api/v1/ai/vision/vqa`, `POST /api/v1/ai/vision/batch`.

**Task 6.4:** Add document parsing endpoints: `POST /api/v1/ai/document/parse`, `POST /api/v1/ai/document/tables`.

---

### Phase 7: Image Generation Worker

**Task 7.1:** Add `candle-core`, `candle-nn`, `candle-transformers` dependencies behind `native-imagegen` feature. Add `image` crate dependency.

**Task 7.2:** Create `services/signapps-ai/src/workers/imagegen/mod.rs` with `NativeImageGen` (candle — FLUX.1/SD via safetensors), `HttpImageGen` (ComfyUI/Automatic1111 API), `CloudImageGen` (DALL-E 3, Replicate).

**Task 7.3:** Add image generation endpoints: `POST /api/v1/ai/image/generate`, `POST /api/v1/ai/image/inpaint`, `POST /api/v1/ai/image/img2img`, `POST /api/v1/ai/image/upscale`, `GET /api/v1/ai/image/models`.

**Task 7.4:** Wire image generation into RAG — when `use_rag_context: true`, enrich the prompt with RAG search results before generating.

---

### Phase 8: Video Workers

**Task 8.1:** Add `ffmpeg-next` dependency behind `native-videogen` feature.

**Task 8.2:** Create `services/signapps-ai/src/workers/video_understand/mod.rs` — `NativeVideoUnderstand` (ffmpeg frame extraction + VisionWorker for descriptions + STT for audio), `CloudVideoUnderstand` (Gemini 1.5 Pro).

**Task 8.3:** Create `services/signapps-ai/src/workers/videogen/mod.rs` — `NativeVideoGen` (candle CogVideoX + ffmpeg), `HttpVideoGen`, `CloudVideoGen` (Runway Gen-3, Kling).

**Task 8.4:** Add video endpoints: `POST /api/v1/ai/video/generate`, `POST /api/v1/ai/video/img2video`, `POST /api/v1/ai/video/analyze`, `POST /api/v1/ai/video/extract-frames`, `POST /api/v1/ai/video/transcribe`, `GET /api/v1/ai/video/models`.

---

### Phase 9: Audio Generation Worker

**Task 9.1:** Create `services/signapps-ai/src/workers/audiogen/mod.rs` — `NativeAudioGen` (candle MusicGen/Stable Audio), `HttpAudioGen`, `CloudAudioGen` (Suno, Udio).

**Task 9.2:** Add audio endpoints: `POST /api/v1/ai/audio/music`, `POST /api/v1/ai/audio/sfx`, `GET /api/v1/ai/audio/models`.

---

### Phase 10: Chat Enrichment

**Task 10.1:** Extend `ChatRequest` in `handlers/chat.rs` — add `attachments: Option<Vec<Attachment>>` and `generate_media: Option<MediaGenHint>`.

**Task 10.2:** When attachments are present, index them via `MultimodalIndexer` before RAG search.

**Task 10.3:** When `generate_media` is set, after the LLM response, parse generation intent and dispatch to the appropriate worker (ImageGen, VideoGen, AudioGen) via `GatewayRouter`.

**Task 10.4:** Auto-index generated outputs via circular pipeline.

**Task 10.5:** Return `generated_media` and `quality_advice` in `ChatResponse`.

---

### Phase 11: Frontend — Dashboard & GPU Monitor

**Task 11.1:** Create `client/src/hooks/use-ai-capabilities.ts` — Zustand store fetching `GET /api/v1/ai/capabilities`.

**Task 11.2:** Create `client/src/components/ai/capability-dashboard.tsx` — Grid of capability cards showing availability, quality, backend type, GPU status.

**Task 11.3:** Create `client/src/components/ai/gpu-monitor.tsx` — Real-time VRAM usage per GPU with loaded models list. Polls `GET /api/v1/ai/gpu/status`.

**Task 11.4:** Create `client/src/components/ai/quality-advisor.tsx` — Shows recommendations for local vs cloud per capability.

**Task 11.5:** Create `client/src/app/ai/page.tsx` — Main AI dashboard page combining capability-dashboard and gpu-monitor.

**Task 11.6:** Create `client/src/app/ai/settings/page.tsx` — GPU profiles selection, model management.

---

### Phase 12: Frontend — Studio & Panels

**Task 12.1:** Create `client/src/hooks/use-ai-image-gen.ts`, `use-ai-video.ts`, `use-ai-audio-gen.ts`, `use-ai-vision.ts`, `use-ai-conversations.ts`.

**Task 12.2:** Create `client/src/components/ai/image-gen-panel.tsx` — Prompt input, style selector, size options, generation preview, seed control.

**Task 12.3:** Create `client/src/components/ai/video-gen-panel.tsx` — Prompt, duration, fps, image-to-video upload.

**Task 12.4:** Create `client/src/components/ai/audio-gen-panel.tsx` — Music/SFX toggle, prompt, duration.

**Task 12.5:** Create `client/src/components/ai/vision-analyzer.tsx` — Image upload, description/VQA toggle.

**Task 12.6:** Create `client/src/components/ai/multimodal-search.tsx` — Text + image search with cross-modal results.

**Task 12.7:** Create `client/src/components/ai/conversation-history.tsx` — List conversations, resume, delete.

**Task 12.8:** Create `client/src/app/ai/studio/page.tsx` — Unified media creation studio with tabs for image/video/audio.

**Task 12.9:** Create `client/src/app/ai/search/page.tsx` — Multimodal search page.

**Task 12.10:** Enrich `client/src/components/layout/ai-chat-bar.tsx` — Add attachment upload, media generation toggle, conversation history.
