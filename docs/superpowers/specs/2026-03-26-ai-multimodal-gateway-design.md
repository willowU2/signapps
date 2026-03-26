# AI Multimodal Gateway — Design Spec

**Date:** 2026-03-26
**Status:** Approved
**Scope:** Transformer signapps-ai en gateway AI unifié avec toutes les capabilities multimodales, binding RAG circulaire, routing intelligent local/cloud.

---

## 1. Contexte & Décisions

### Hardware cible principal

| Composant | Détails |
|-----------|---------|
| GPU dédié | 2x AMD Radeon AI PRO R9700 — 64 GB VRAM total |
| iGPU | Intel UHD 770 (display) → 2x R9700 100% compute |
| CPU | Intel Core i9-14900K — 24 cœurs / 32 threads |
| RAM | 192 GB |
| Stockage | 14 TB SSD (RAID 0) |
| Backend GPU | ROCm (AMD) |
| Tier | Ultra++ |

### Décisions architecturales

| Décision | Choix |
|----------|-------|
| Hardware | Adaptatif (low → high-end, piloté par `HardwareProfile`) |
| Scope | Tous les services AI + extensible |
| Cloud/Local | Agnostique, routing intelligent avec recommandation qualité |
| RAG binding | Pipeline circulaire (index → enrich → generate → re-index) |
| Extensibilité | Trait Rust + protocole HTTP standardisé (pattern existant) |
| Embeddings | Hybride : texte 384d existant + espace multimodal SigLIP 1024d |
| Vidéo | Compréhension + génération complète, features studio débloquées par hardware |
| Modèles | Profils recommandés + téléchargement à la demande |

### Approche retenue

**Approche C — AI Gateway unifié + Workers spécialisés.** `signapps-ai` devient le gateway unique. Il gère le routing, le RAG multimodal, et la logique métier. Les tâches d'inférence lourde sont déléguées à des workers (trait Rust natif, service HTTP externe, ou API cloud).

---

## 2. Capability Registry

### Registre générique (tous tiers hardware)

| Capability | Trait Rust | Modèle Local (≤8GB) | Modèle Local (16GB) | Modèle Local (24GB+) | Cloud Fallback |
|------------|-----------|---------------------|---------------------|----------------------|----------------|
| LLM Chat | `LlmWorker` | Llama 3.2 3B (Q4) | Llama 3.1 8B (Q6) | Llama 3.1 70B (Q4) | OpenAI, Anthropic, Gemini |
| LLM Code | `LlmWorker` | Qwen 2.5 Coder 3B | Qwen 2.5 Coder 7B | Qwen 2.5 Coder 32B | Claude, GPT-4o |
| Text Embeddings | `EmbeddingBackend` | nomic-embed-text (384d) | nomic-embed-text | nomic-embed-text | OpenAI ada-002 |
| Multimodal Embeddings | `MultimodalEmbedBackend` | SigLIP-base (768d) | SigLIP-large (1024d) | SigLIP-SO400M (1024d) | OpenAI CLIP |
| Vision/VQA | `VisionWorker` | MoonDream 2 (1.8B) | LLaVA 1.6 7B | InternVL2-40B | GPT-4o Vision, Claude Vision |
| Image Generation | `ImageGenWorker` | SD Turbo (1-step) | SDXL-Lightning / FLUX.1-schnell | FLUX.1-dev (fp16) | DALL-E 3, Midjourney |
| Image Edit | `ImageGenWorker` | — | SDXL Inpaint | FLUX.1-Fill + ControlNet | DALL-E 3 edit |
| Video Understanding | `VideoUnderstandWorker` | Frames + Vision | LLaVA-Video 7B | Qwen2-VL-72B (Q4) | Gemini 1.5 Pro |
| Video Generation | `VideoGenWorker` | AnimateDiff-Lightning | CogVideoX-2B | CogVideoX-5B | Runway Gen-3, Kling |
| Video Studio (D) | `VideoGenWorker` | — | — | CogVideoX-5B + lip-sync + compo | Runway, Kling |
| Audio/Music Gen | `AudioGenWorker` | — | Stable Audio Open | MusicGen-Large (3.3B) | Suno, Udio |
| Sound Effects | `AudioGenWorker` | — | Stable Audio Open | Stable Audio Open | — |
| Reranking | `RerankerBackend` | bge-reranker-base | bge-reranker-v2-m3 | bge-reranker-v2-gemma | Cohere Rerank |
| Document Parsing | `DocParseWorker` | ocrs (existant) | ocrs + PaddleOCR | ocrs + PaddleOCR | Azure Doc Intelligence (PDFs complexes) |
| STT | `SttBackend` (existant) | Whisper tiny/base | Whisper medium | Whisper large-v3 | OpenAI Whisper API |
| TTS | `TtsBackend` (existant) | Piper (existant) | Piper HD / Kokoro | F5-TTS / XTTS-v2 | ElevenLabs, OpenAI TTS |
| OCR | `OcrBackend` (existant) | ocrs (existant) | ocrs | ocrs + PaddleOCR | Google Vision |

### Registre spécifique — Config développeur (2x R9700 32GB / ROCm / 192GB RAM)

| Capability | Modèle Local | VRAM | Qualité | Cloud recommandé ? |
|------------|-------------|------|---------|---------------------|
| LLM Chat | Qwen 2.5 72B (Q6_K) | ~50 GB (2x GPU) | ★★★★★ | Non |
| LLM Code | Qwen 2.5 Coder 32B (Q8) | ~34 GB (1 GPU) | ★★★★★ | Non |
| Text Embeddings | nomic-embed-text (384d) | CPU + RAM | ★★★★☆ | Non |
| Multimodal Embeddings | SigLIP-SO400M (1024d) | ~1.5 GB | ★★★★★ | Non |
| Vision/VQA | InternVL2-40B ou Qwen2-VL-72B (Q4) | ~28-40 GB | ★★★★★ | Non |
| Image Generation | FLUX.1-dev (fp16) | ~24 GB | ★★★★★ | Non |
| Image Edit/Inpaint | FLUX.1-Fill + ControlNet | ~26 GB | ★★★★☆ | Non |
| Video Understanding | Qwen2-VL-72B (Q4) | ~40 GB (2x GPU) | ★★★★★ | Non |
| Video Generation | CogVideoX-5B (fp16) | ~18 GB | ★★★☆☆ | Runway Gen-3 (★★★★★) |
| Video Studio (D) | CogVideoX-5B + lip-sync + compo | ~24 GB | ★★★☆☆ | Kling/Runway (★★★★★) |
| Audio/Music Gen | MusicGen-Large (3.3B) | ~14 GB | ★★★★☆ | Suno (★★★★★) pour longue durée |
| Sound Effects | Stable Audio Open | ~8 GB | ★★★★☆ | Non |
| Reranking | bge-reranker-v2-gemma | ~6 GB | ★★★★★ | Non |
| Document Parsing | ocrs + PaddleOCR (Rust) | CPU | ★★★★☆ | Azure Doc Intelligence (PDFs complexes avec tableaux) |
| STT | Whisper large-v3 | ~3 GB | ★★★★★ | Non |
| TTS | F5-TTS / XTTS-v2 | ~4 GB | ★★★★☆ | ElevenLabs (★★★★★) |
| OCR | ocrs + PaddleOCR | CPU | ★★★★☆ | Non |

### Hardware Tiers

```rust
pub enum HardwareTier {
    Cpu,        // Pas de GPU
    LowVram,    // ≤8 GB
    MidVram,    // 8-16 GB
    HighVram,   // 16-24 GB
    UltraVram,  // 24+ GB ou multi-GPU
}

pub struct CapabilityProfile {
    pub capability: Capability,
    pub available: bool,
    pub recommended_model: String,
    pub quality_score: f32,        // 0.0-1.0
    pub cloud_quality_score: f32,
    pub upgrade_recommended: bool, // true si cloud >> local (>0.3 gap)
    pub vram_required_mb: u64,
}
```

### Stratégie multi-GPU (config développeur)

```
GPU 0 (32 GB) — "Always-on"           GPU 1 (32 GB) — "Pool dynamique"
├── LLM 72B shard 0 (25 GB)           ├── LLM 72B shard 1 (25 GB)
├── Whisper large-v3 (3 GB)           ├── SigLIP (1.5 GB)
├── Reranker (3 GB)                   └── ~5.5 GB libre → swap:
└── ~1 GB libre                            ├── FLUX.1-dev
                                           ├── CogVideoX
                                           └── MusicGen

Mode "Génération" (pas de chat LLM actif) :
  GPU 0: FLUX.1-dev (24 GB) + Reranker (3 GB) + Whisper (3 GB)
  GPU 1: CogVideoX (18 GB) + SigLIP (1.5 GB) + TTS (4 GB)

RAM (192 GB) — CPU inference :
  ├── nomic-embed-text
  ├── ocrs / PaddleOCR
  └── Modèles ONNX légers
```

---

## 3. Architecture Gateway

### Vue d'ensemble

```
signapps-ai (port 3005) — AI GATEWAY
  ├── gateway/
  │   ├── router.rs          → Route capability + hardware → meilleur worker
  │   ├── quality_advisor.rs → Compare qualité local vs cloud, recommande
  │   └── capability.rs      → Registry des capabilities disponibles
  ├── rag/
  │   ├── pipeline.rs        → RAG multimodal (existant enrichi)
  │   ├── multimodal_indexer → Indexation auto-detect média
  │   ├── multimodal_search  → Fusion RRF dual-space
  │   └── circular_pipeline  → Re-indexation des outputs générés
  ├── memory/
  │   └── conversation.rs    → Historique persistant, résumé auto
  ├── models/
  │   ├── orchestrator.rs    → VRAM multi-GPU, load/unload LRU
  │   └── profiles.rs        → Hardware → modèles recommandés
  └── workers/ (trait-based: Native | HTTP | Cloud)
      ├── llm/               → existant refactoré
      ├── vision/            → InternVL2, GPT-4o Vision
      ├── imagegen/          → FLUX.1, DALL-E 3
      ├── videogen/          → CogVideoX, Runway
      ├── video_understand/  → frames+vision, Gemini
      ├── audiogen/          → MusicGen, Suno
      ├── reranker/          → bge-reranker, Cohere
      ├── docparse/          → ocrs + PaddleOCR (ONNX), Azure Doc Intelligence
      └── embeddings/        → SigLIP, OpenAI CLIP

signapps-media (port 3009) — inchangé (STT/TTS/OCR/Voice)
```

### Traits principaux

```rust
#[derive(Clone, Debug, PartialEq)]
pub enum Capability {
    Llm, Vision, ImageGen, VideoGen, VideoUnderstand,
    AudioGen, Rerank, DocParse, TextEmbed, MultimodalEmbed,
}

#[derive(Clone, Debug)]
pub enum BackendType {
    Native,
    Http { url: String },
    Cloud { provider: String, api_key: String },
}

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

#[async_trait]
pub trait ImageGenWorker: AiWorker {
    async fn generate(&self, req: ImageGenRequest) -> Result<ImageGenResult>;
    async fn inpaint(&self, req: InpaintRequest) -> Result<ImageGenResult>;
    async fn img2img(&self, req: Img2ImgRequest) -> Result<ImageGenResult>;
    async fn upscale(&self, req: UpscaleRequest) -> Result<ImageGenResult>;
    async fn list_models(&self) -> Result<Vec<ModelInfo>>;
}

#[async_trait]
pub trait VisionWorker: AiWorker {
    async fn describe(&self, image: Bytes, prompt: Option<String>) -> Result<VisionResult>;
    async fn vqa(&self, image: Bytes, question: &str) -> Result<VisionResult>;
    async fn batch_describe(&self, images: Vec<Bytes>) -> Result<Vec<VisionResult>>;
}

#[async_trait]
pub trait VideoGenWorker: AiWorker {
    async fn text_to_video(&self, req: VideoGenRequest) -> Result<VideoGenResult>;
    async fn img_to_video(&self, req: ImgToVideoRequest) -> Result<VideoGenResult>;
    async fn list_models(&self) -> Result<Vec<ModelInfo>>;
}

#[async_trait]
pub trait VideoUnderstandWorker: AiWorker {
    async fn analyze(&self, video: Bytes, prompt: Option<String>) -> Result<VideoAnalysis>;
    async fn extract_frames(&self, video: Bytes, opts: FrameExtractOpts) -> Result<Vec<Frame>>;
    async fn transcribe_video(&self, video: Bytes) -> Result<VideoTranscript>;
}

#[async_trait]
pub trait AudioGenWorker: AiWorker {
    async fn generate_music(&self, req: MusicGenRequest) -> Result<AudioGenResult>;
    async fn generate_sfx(&self, req: SfxGenRequest) -> Result<AudioGenResult>;
    async fn list_models(&self) -> Result<Vec<ModelInfo>>;
}

#[async_trait]
pub trait RerankerBackend: AiWorker {
    async fn rerank(&self, query: &str, docs: Vec<String>, top_k: usize) -> Result<Vec<RerankResult>>;
}

#[async_trait]
pub trait DocParseWorker: AiWorker {
    async fn parse(&self, doc: Bytes, filename: &str) -> Result<ParsedDocument>;
    async fn extract_tables(&self, doc: Bytes) -> Result<Vec<Table>>;
}

#[async_trait]
pub trait MultimodalEmbedBackend: AiWorker {
    async fn embed_text(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>>;
    async fn embed_image(&self, images: Vec<Bytes>) -> Result<Vec<Vec<f32>>>;
    async fn embed_audio(&self, audio: Vec<Bytes>) -> Result<Vec<Vec<f32>>>;
}
```

### Gateway Router

```rust
pub struct GatewayRouter {
    workers: HashMap<Capability, Vec<Arc<dyn AiWorker>>>,
    hardware: HardwareProfile,
    model_orchestrator: Arc<ModelOrchestrator>,
}

impl GatewayRouter {
    /// Sélectionne le meilleur worker : Native > Http > Cloud
    /// Sauf si quality_score cloud >> local (>0.3 écart)
    pub async fn route(&self, cap: Capability) -> Result<Arc<dyn AiWorker>>;

    /// Recommandation qualité local vs cloud
    pub fn quality_advice(&self, cap: Capability) -> Option<QualityAdvice>;
}

pub struct QualityAdvice {
    pub capability: Capability,
    pub local_quality: f32,
    pub cloud_quality: f32,
    pub recommendation: String,
    pub cloud_provider: Option<String>,
}
```

### Model Orchestrator

```rust
pub struct ModelOrchestrator {
    gpus: Vec<GpuState>,
    ram_models: DashMap<String, LoadedModel>,
    loading_queue: Mutex<VecDeque<LoadRequest>>,
}

pub struct GpuState {
    pub id: usize,
    pub total_vram_mb: u64,
    pub used_vram_mb: u64,
    pub loaded_models: Vec<LoadedModel>,
    pub role: GpuRole,
}

pub enum GpuRole {
    AlwaysOn,     // GPU 0 — modèles permanents
    DynamicPool,  // GPU 1 — swap in/out LRU
}

impl ModelOrchestrator {
    /// Charge un modèle, LRU eviction si nécessaire
    pub async fn ensure_loaded(&self, model_id: &str, vram_needed: u64) -> Result<()>;

    /// Profil recommandé basé sur hardware détecté
    pub fn recommended_profile(&self) -> LoadProfile;
}
```

---

## 4. RAG Multimodal & Pipeline Circulaire

### Dual-space embeddings

| Espace | Table | Dimension | Modèle | Contenu |
|--------|-------|-----------|--------|---------|
| Texte (existant) | `ai.document_vectors` | 384 | nomic-embed-text | Documents, PDFs, transcriptions, descriptions |
| Multimodal (nouveau) | `ai.multimodal_vectors` | 1024 | SigLIP-SO400M | Images, frames vidéo, segments audio, texte cross-modal |

Recherche : fusion RRF (Reciprocal Rank Fusion) des deux espaces pour les requêtes cross-modales. Espace texte seul pour les requêtes texte-only (pas de régression).

### Pipeline circulaire

```
INPUT (tout média)
  │
  ▼
INDEXATION auto-detect
  ├── Texte/PDF → chunks texte → embed 384d → espace 1
  ├── Image → Vision description → espace 1 + SigLIP embed → espace 2
  ├── Audio → STT transcription → espace 1 + audio embed → espace 2
  └── Vidéo → frames clés + transcription → espace 1 + espace 2
  │
  ▼
RECHERCHE multimodale (RRF fusion + reranking optionnel)
  │
  ▼
ENRICHISSEMENT (contexte RAG injecté au LLM + générateurs)
  │
  ▼
GÉNÉRATION (image, vidéo, audio, texte) avec contexte RAG
  │
  ▼
RE-INDEXATION automatique des outputs générés
  └── Boucle vers INDEXATION (pipeline circulaire)
```

### Indexation par type de média

```rust
pub struct MultimodalIndexer {
    text_embedder: Arc<dyn EmbeddingBackend>,
    multimodal_embedder: Arc<dyn MultimodalEmbedBackend>,
    vision: Arc<dyn VisionWorker>,
    stt: Arc<dyn SttBackend>,
    doc_parser: Arc<dyn DocParseWorker>,
    vector_repo: VectorRepository,
    multimodal_repo: MultimodalVectorRepository,
}

impl MultimodalIndexer {
    /// Indexe n'importe quel média — détection auto du type
    pub async fn index(&self, input: IndexInput) -> Result<IndexResult>;

    /// Re-indexe automatiquement les outputs générés
    pub async fn index_generated_output(&self, output: GeneratedOutput) -> Result<()>;
}
```

Flux par type :
- **Texte/MD/HTML** → chunks → embed texte 384d → espace 1
- **PDF/DOCX/PPTX** → parse structuré → texte → espace 1 + images extraites → espace 2
- **Image** → Vision description → espace 1 (texte) + SigLIP embed → espace 2 (visuel)
- **Audio** → STT transcription → espace 1 + embed audio → espace 2
- **Vidéo** → frames clés → Vision desc + embed → espaces 1+2 + transcription audio → espace 1

### Recherche fusionnée

```rust
pub struct MultimodalSearch {
    text_repo: VectorRepository,
    multimodal_repo: MultimodalVectorRepository,
    reranker: Option<Arc<dyn RerankerBackend>>,
    multimodal_embedder: Arc<dyn MultimodalEmbedBackend>,
    text_embedder: Arc<dyn EmbeddingBackend>,
}

impl MultimodalSearch {
    /// Texte → recherche dans les 2 espaces + fusion RRF + reranking
    pub async fn search(&self, query: &SearchQuery) -> Result<Vec<SearchResult>>;

    /// Image → recherche par similarité visuelle (espace 2)
    pub async fn search_by_image(&self, image: Bytes, limit: usize) -> Result<Vec<SearchResult>>;
}
```

### Conversation Memory

```rust
pub struct ConversationMemory {
    pool: PgPool,
}

impl ConversationMemory {
    pub async fn get_or_create(&self, conv_id: Option<Uuid>, user_id: Uuid) -> Result<Conversation>;
    pub async fn add_message(&self, conv_id: Uuid, msg: ConversationMessage) -> Result<()>;
    pub async fn get_context(&self, conv_id: Uuid, max_messages: usize) -> Result<Vec<ConversationMessage>>;
    pub async fn summarize_if_needed(&self, conv_id: Uuid) -> Result<Option<String>>;
}
```

---

## 5. API Endpoints

### Endpoints existants enrichis

```
POST /api/v1/ai/chat                    ← enrichi multimodal (attachments, media gen, conversation_id)
POST /api/v1/ai/chat/stream             ← enrichi multimodal
GET  /api/v1/ai/search                  ← enrichi fusion RRF dual-space
POST /api/v1/ai/index                   ← enrichi auto-detect média
GET  /api/v1/ai/models                  ← existant
GET  /api/v1/ai/models/local            ← existant
POST /api/v1/ai/models/download         ← existant
GET  /api/v1/ai/providers               ← existant
GET  /api/v1/ai/collections             ← existant
```

### Nouveaux endpoints

```
── Recherche ──
POST /api/v1/ai/search/image            → recherche par image

── Vision ──
POST /api/v1/ai/vision/describe         → description d'image
POST /api/v1/ai/vision/vqa              → question sur image
POST /api/v1/ai/vision/batch            → batch description

── Image Generation ──
POST /api/v1/ai/image/generate          → text-to-image
POST /api/v1/ai/image/inpaint           → inpainting
POST /api/v1/ai/image/img2img           → image-to-image
POST /api/v1/ai/image/upscale           → super-résolution
GET  /api/v1/ai/image/models            → modèles disponibles

── Video ──
POST /api/v1/ai/video/generate          → text-to-video
POST /api/v1/ai/video/img2video         → image-to-video
POST /api/v1/ai/video/analyze           → compréhension vidéo
POST /api/v1/ai/video/extract-frames    → frames clés
POST /api/v1/ai/video/transcribe        → transcription audio+visuel
GET  /api/v1/ai/video/models            → modèles disponibles

── Audio Generation ──
POST /api/v1/ai/audio/music             → text-to-music
POST /api/v1/ai/audio/sfx              → sound effects
GET  /api/v1/ai/audio/models            → modèles disponibles

── Document Parsing ──
POST /api/v1/ai/document/parse          → parsing avancé (PDF, DOCX, PPTX)
POST /api/v1/ai/document/tables         → extraction de tableaux

── Conversations ──
GET  /api/v1/ai/conversations           → liste conversations
GET  /api/v1/ai/conversations/:id       → historique
DELETE /api/v1/ai/conversations/:id     → supprimer

── Gateway Management ──
GET  /api/v1/ai/capabilities            → capabilities + qualité + état
GET  /api/v1/ai/capabilities/:cap/advice → conseil local vs cloud
GET  /api/v1/ai/gpu/status              → état VRAM temps réel
POST /api/v1/ai/gpu/profile             → appliquer profil de chargement
GET  /api/v1/ai/gpu/profiles            → profils disponibles
GET  /api/v1/ai/models/recommended      → recommandations par hardware
```

### Requêtes/Réponses clés

```rust
// Chat enrichi
pub struct ChatRequest {
    pub question: String,
    pub conversation_id: Option<Uuid>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub include_sources: bool,
    pub collections: Option<Vec<String>>,
    pub language: Option<String>,
    pub system_prompt: Option<String>,
    pub attachments: Option<Vec<Attachment>>,    // images, audio, docs joints
    pub generate_media: Option<MediaGenHint>,    // Auto, Image, Audio, None
}

pub struct ChatResponse {
    pub answer: String,
    pub sources: Vec<SourceReference>,
    pub generated_media: Vec<GeneratedMedia>,
    pub conversation_id: Uuid,
    pub tokens_used: Option<i32>,
    pub quality_advice: Option<QualityAdvice>,
}

// Image Generation
pub struct ImageGenRequest {
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub num_steps: Option<u32>,
    pub guidance_scale: Option<f32>,
    pub seed: Option<i64>,
    pub model: Option<String>,
    pub use_rag_context: bool,
    pub collections: Option<Vec<String>>,
    pub style: Option<String>,
}

// Video Generation
pub struct VideoGenRequest {
    pub prompt: String,
    pub duration_seconds: Option<f32>,
    pub fps: Option<u32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub source_image: Option<Bytes>,
    pub model: Option<String>,
    pub use_rag_context: bool,
}

// Capabilities
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
```

---

## 6. Frontend

### Nouveaux fichiers

```
client/src/
├── hooks/
│   ├── use-ai-capabilities.ts       ← état des capabilities
│   ├── use-ai-image-gen.ts          ← génération d'images
│   ├── use-ai-video.ts              ← vidéo gen + compréhension
│   ├── use-ai-audio-gen.ts          ← musique + sfx
│   ├── use-ai-vision.ts             ← analyse d'images
│   └── use-ai-conversations.ts      ← historique conversations
├── components/ai/
│   ├── capability-dashboard.tsx      ← vue d'ensemble capabilities
│   ├── gpu-monitor.tsx               ← état VRAM temps réel
│   ├── quality-advisor.tsx           ← recommandations local/cloud
│   ├── media-generator.tsx           ← UI unifiée génération
│   ├── image-gen-panel.tsx           ← panneau image
│   ├── video-gen-panel.tsx           ← panneau vidéo
│   ├── audio-gen-panel.tsx           ← panneau audio
│   ├── vision-analyzer.tsx           ← analyse d'images
│   ├── multimodal-search.tsx         ← recherche cross-modale
│   └── conversation-history.tsx      ← historique avec reprise
├── app/ai/
│   ├── page.tsx                      ← Dashboard AI principal
│   ├── studio/page.tsx               ← studio de création multimédia
│   ├── search/page.tsx               ← recherche multimodale
│   └── settings/page.tsx             ← enrichi capabilities + GPU
```

Fichiers existants enrichis : `use-ai-routing.ts`, `use-ai-search.ts`, `ai-chat-bar.tsx`.

---

## 7. Implémentation Backend

### Organisation fichiers (signapps-ai)

```
services/signapps-ai/src/
├── main.rs                          ← enrichi (gateway bootstrap)
├── gateway/
│   ├── mod.rs
│   ├── router.rs
│   ├── quality_advisor.rs
│   ├── capability_registry.rs
│   └── middleware.rs
├── rag/
│   ├── mod.rs
│   ├── pipeline.rs                  ← existant enrichi
│   ├── chunker.rs                   ← existant
│   ├── multimodal_indexer.rs
│   ├── multimodal_search.rs
│   ├── circular_pipeline.rs
│   └── reranker.rs
├── memory/
│   ├── mod.rs
│   ├── conversation.rs
│   ├── context_builder.rs
│   └── summarizer.rs
├── models/
│   ├── mod.rs
│   ├── orchestrator.rs
│   ├── profiles.rs
│   └── manager.rs                   ← existant enrichi
├── workers/
│   ├── mod.rs
│   ├── llm/         (existant refactoré : ollama, openai, anthropic, gemini, llamacpp)
│   ├── vision/      (native.rs, http.rs, cloud.rs)
│   ├── imagegen/    (native.rs, http.rs, cloud.rs)
│   ├── videogen/    (native.rs, http.rs, cloud.rs)
│   ├── video_understand/ (native.rs, http.rs, cloud.rs)
│   ├── audiogen/    (native.rs, http.rs, cloud.rs)
│   ├── reranker/    (native.rs, http.rs, cloud.rs)
│   ├── docparse/    (native.rs, http.rs, cloud.rs)
│   └── embeddings/  (native.rs, http.rs, cloud.rs)
├── handlers/        (existants + nouveaux endpoints)
├── embeddings/      (existant)
├── vectors/         (existant)
├── indexer/         (existant)
└── tools/           (existant)
```

### Feature gates

```toml
[features]
default = []
native-llm       = ["llama-cpp-2"]
native-vision    = ["llama-cpp-2"]
native-imagegen  = ["candle-core", "candle-nn", "candle-transformers"]
native-videogen  = ["candle-core", "dep:ffmpeg-next"]
native-audiogen  = ["candle-core"]
native-reranker  = ["ort"]
native-embedmm  = ["ort"]
native-docparse  = ["ort"]                   # ocrs + PaddleOCR ONNX
native-all = ["native-llm", "native-vision", "native-imagegen", "native-videogen",
              "native-audiogen", "native-reranker", "native-embedmm", "native-docparse"]
gpu-rocm   = []
gpu-cuda   = []
gpu-vulkan = []
gpu-metal  = []
```

### Technologies par worker

| Worker | Lib Native (Rust) | Pourquoi |
|--------|-------------------|----------|
| LLM | `llama-cpp-2` (existant) | GGUF, ROCm hipBLAS, tensor parallel |
| Vision | `llama-cpp-2` multimodal | GGUF multimodal, même runtime LLM |
| Image Gen | `candle-core/nn/transformers` | Rust natif, FLUX/SD, ROCm via candle-rocm |
| Video Gen | `candle-core` + `ffmpeg-next` | CogVideoX frames + ffmpeg composition |
| Audio Gen | `candle-core` | MusicGen/Stable Audio en Rust |
| Reranker | `ort` (ONNX Runtime) | bge-reranker, ROCm EP |
| Multimodal Embed | `ort` (ONNX Runtime) | SigLIP ONNX, ROCm EP |
| Doc Parse | ocrs (existant) + PaddleOCR (ONNX) | Rust pur, cloud fallback pour PDFs complexes avec tableaux |
| Video Frames | `ffmpeg-next` | Extraction frames, séparation audio |

### Dépendances ajoutées

```toml
candle-core = { version = "0.8", optional = true, features = ["rocm"] }
candle-nn = { version = "0.8", optional = true }
candle-transformers = { version = "0.8", optional = true }
ort = { version = "2", optional = true, features = ["rocm"] }
ffmpeg-next = { version = "7", optional = true }
image = "0.25"
hf-hub = "0.3"
tokenizers = "0.20"
```

---

## 8. Migration SQL

Fichier unique : `migrations/059_ai_multimodal_gateway.sql`

```sql
-- 1. Multimodal vectors (SigLIP 1024-dim)
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
CREATE INDEX idx_mm_vectors_embedding ON ai.multimodal_vectors
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_mm_vectors_collection ON ai.multimodal_vectors(collection);
CREATE INDEX idx_mm_vectors_media_type ON ai.multimodal_vectors(media_type);
CREATE INDEX idx_mm_vectors_metadata ON ai.multimodal_vectors USING GIN (metadata);
CREATE INDEX idx_mm_vectors_document_id ON ai.multimodal_vectors(document_id);

-- 2. Conversations
CREATE TABLE IF NOT EXISTS ai.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(512),
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_conversations_user ON ai.conversations(user_id, updated_at DESC);

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
CREATE INDEX idx_conv_msgs_conv ON ai.conversation_messages(conversation_id, created_at);

-- 3. Generated media tracking
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
CREATE INDEX idx_generated_media_user ON ai.generated_media(user_id, created_at DESC);
CREATE INDEX idx_generated_media_indexed ON ai.generated_media(indexed) WHERE indexed = false;

-- 4. Model cache registry
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

---

## 9. ROCm Compatibility

| Framework | Support ROCm | Notes |
|-----------|-------------|-------|
| llama.cpp | Natif (hipBLAS) | LLM + Vision GGUF |
| candle | candle-rocm | Image/Video/Audio gen |
| ONNX Runtime | ROCmExecutionProvider | Reranker, SigLIP |
| whisper.cpp | hipBLAS | STT existant |
| ffmpeg | CPU (suffisant) | Frame extraction |
| Vulkan | Natif AMD (fallback) | Si ROCm problématique |
