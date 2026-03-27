//! SignApps AI Service - RAG and LLM integration
//!

use axum::{
    middleware,
    routing::{delete, get, post},
    Router,
};
use gateway::GatewayRouter;
use models::ModelOrchestrator;
use opendal::{
    services::{Fs, S3},
    Operator,
};
use signapps_common::bootstrap::{env_or, init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{
    auth_middleware, logging_middleware, request_id_middleware, require_admin,
};
use signapps_common::{AuthState, JwtConfig};
use signapps_db::DatabasePool;
use signapps_runtime::{HardwareProfile, ModelManager};
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::cors::{AllowOrigin, CorsLayer};

mod embeddings;
mod gateway;
mod handlers;
mod indexer;
mod llm;
mod memory;
mod models;
mod rag;
mod vectors;
mod workers;

use embeddings::EmbeddingsClient;
use handlers::{
    action, audio_gen, capabilities, chat, collections, conversations, doc_parse, gpu_status,
    health, image_gen, index, model_management, models as model_handlers, providers, search,
    search_image, transcription, video, vision, webhook,
};
use indexer::IndexPipeline;
use llm::{create_provider, LlmProviderType, ProviderConfig, ProviderRegistry};
use rag::chunker::TextChunker;
use rag::circular_pipeline::CircularPipeline;
use rag::multimodal_indexer::MultimodalIndexer;
use rag::RagPipeline;
use vectors::VectorService;
use workers::traits::{AiWorker, MultimodalEmbedWorker, VisionWorker};

/// Application state shared across handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub vectors: VectorService,
    pub embeddings: EmbeddingsClient,
    pub providers: Arc<ProviderRegistry>,
    pub storage: Operator,
    pub rag: RagPipeline,
    pub indexer: IndexPipeline,
    pub jwt_config: JwtConfig,
    pub model_manager: Option<Arc<ModelManager>>,
    pub hardware: Option<HardwareProfile>,
    pub gateway: Option<Arc<GatewayRouter>>,
    pub mm_indexer: Option<Arc<MultimodalIndexer>>,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_ai");
    load_env();

    let config = ServiceConfig::from_env("signapps-ai", 3005);
    config.log_startup();

    // Load AI-specific configuration
    let embeddings_url = env_or("EMBEDDINGS_URL", "http://localhost:8080");

    // Initialize database pool
    let pool = signapps_db::create_pool(&config.database_url).await?;
    tracing::info!("Database connection established");

    // Run migrations (non-fatal: pgvector may not be installed)
    match signapps_db::run_migrations(&pool).await {
        Ok(()) => tracing::info!("Database migrations completed"),
        Err(e) => tracing::warn!("Migration warning (non-fatal): {}", e),
    }

    // Hardware detection + model manager
    let hardware = HardwareProfile::detect().await;
    tracing::info!(
        "Hardware: {} (VRAM: {} MB, CPU: {} cores)",
        hardware.preferred_backend,
        hardware.total_vram_mb,
        hardware.cpu_cores
    );
    let model_manager = Arc::new(ModelManager::new(None));

    // Initialize clients
    let vectors = VectorService::new(pool.clone());
    tracing::info!("Vector service initialized (pgvector)");

    let embeddings = EmbeddingsClient::new(&embeddings_url);
    tracing::info!("Embeddings client initialized");

    // Initialize Storage Operator (OpenDAL)
    let storage_mode = env_or("STORAGE_MODE", "fs");
    let storage = if storage_mode == "s3" {
        let endpoint = std::env::var("STORAGE_ENDPOINT").unwrap_or_default();
        let access_key = std::env::var("STORAGE_ACCESS_KEY").unwrap_or_default();
        let secret_key = std::env::var("STORAGE_SECRET_KEY").unwrap_or_default();
        let region = std::env::var("STORAGE_REGION").unwrap_or_else(|_| "auto".into());
        let bucket = std::env::var("STORAGE_BUCKET").unwrap_or_default();

        let builder = S3::default()
            .endpoint(&endpoint)
            .access_key_id(&access_key)
            .secret_access_key(&secret_key)
            .region(&region)
            .bucket(&bucket);

        Operator::new(builder)?.finish()
    } else {
        let root = std::env::var("STORAGE_FS_ROOT")
            .or_else(|_| std::env::var("STORAGE_ROOT"))
            .unwrap_or_else(|_| "./data/storage".to_string());
        let builder = Fs::default().root(&root);
        Operator::new(builder)?.finish()
    };
    tracing::info!("Storage operator initialized (mode: {})", storage_mode);

    // Build provider registry from environment variables
    let requested_default = std::env::var("LLM_PROVIDER").unwrap_or_default();
    let mut registry = ProviderRegistry::new(requested_default.clone());
    let mut first_provider_id: Option<String> = None;

    // vLLM
    if let Ok(url) = std::env::var("VLLM_URL") {
        if !url.is_empty() {
            let default_model = std::env::var("VLLM_MODEL")
                .or_else(|_| std::env::var("DEFAULT_MODEL"))
                .unwrap_or_else(|_| "meta-llama/Llama-3.2-3B-Instruct".to_string());
            let config = ProviderConfig {
                provider_type: LlmProviderType::Vllm,
                base_url: url,
                api_key: None,
                default_model,
                enabled: true,
            };
            match create_provider(&config) {
                Ok(provider) => {
                    tracing::info!("Registered vLLM provider");
                    if first_provider_id.is_none() {
                        first_provider_id = Some("vllm".to_string());
                    }
                    registry.register("vllm", config, provider);
                },
                Err(e) => {
                    tracing::warn!("Failed to create vLLM provider: {}", e)
                },
            }
        }
    }

    // Ollama
    if let Ok(url) = std::env::var("OLLAMA_URL") {
        if !url.is_empty() {
            let default_model =
                std::env::var("OLLAMA_MODEL").unwrap_or_else(|_| "llama3.2:3b".to_string());
            let config = ProviderConfig {
                provider_type: LlmProviderType::Ollama,
                base_url: url,
                api_key: None,
                default_model,
                enabled: true,
            };
            match create_provider(&config) {
                Ok(provider) => {
                    tracing::info!("Registered Ollama provider");
                    if first_provider_id.is_none() {
                        first_provider_id = Some("ollama".to_string());
                    }
                    registry.register("ollama", config, provider);
                },
                Err(e) => {
                    tracing::warn!("Failed to create Ollama provider: {}", e)
                },
            }
        }
    }

    // OpenAI
    if let Ok(key) = std::env::var("OPENAI_API_KEY") {
        if !key.is_empty() {
            let default_model =
                std::env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-4o-mini".to_string());
            let config = ProviderConfig {
                provider_type: LlmProviderType::OpenAI,
                base_url: "https://api.openai.com".to_string(),
                api_key: Some(key),
                default_model,
                enabled: true,
            };
            match create_provider(&config) {
                Ok(provider) => {
                    tracing::info!("Registered OpenAI provider");
                    if first_provider_id.is_none() {
                        first_provider_id = Some("openai".to_string());
                    }
                    registry.register("openai", config, provider);
                },
                Err(e) => {
                    tracing::warn!("Failed to create OpenAI provider: {}", e)
                },
            }
        }
    }

    // Anthropic
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        if !key.is_empty() {
            let default_model = std::env::var("ANTHROPIC_MODEL")
                .unwrap_or_else(|_| "claude-sonnet-4-0-20250514".to_string());
            let config = ProviderConfig {
                provider_type: LlmProviderType::Anthropic,
                base_url: "https://api.anthropic.com".to_string(),
                api_key: Some(key),
                default_model,
                enabled: true,
            };
            match create_provider(&config) {
                Ok(provider) => {
                    tracing::info!("Registered Anthropic provider");
                    if first_provider_id.is_none() {
                        first_provider_id = Some("anthropic".to_string());
                    }
                    registry.register("anthropic", config, provider);
                },
                Err(e) => {
                    tracing::warn!("Failed to create Anthropic provider: {}", e)
                },
            }
        }
    }

    // Google Gemini
    if let Ok(key) = std::env::var("GEMINI_API_KEY") {
        if !key.is_empty() {
            let default_model =
                std::env::var("GEMINI_MODEL").unwrap_or_else(|_| "gemini-2.0-flash".to_string());
            let config = ProviderConfig {
                provider_type: LlmProviderType::Gemini,
                base_url: "https://generativelanguage.googleapis.com".to_string(),
                api_key: Some(key),
                default_model,
                enabled: true,
            };
            match create_provider(&config) {
                Ok(provider) => {
                    tracing::info!("Registered Gemini provider");
                    if first_provider_id.is_none() {
                        first_provider_id = Some("gemini".to_string());
                    }
                    registry.register("gemini", config, provider);
                },
                Err(e) => {
                    tracing::warn!("Failed to create Gemini provider: {}", e)
                },
            }
        }
    }

    // LM Studio (local, OpenAI-compatible)
    if let Ok(url) = std::env::var("LMSTUDIO_URL") {
        if !url.is_empty() {
            let default_model =
                std::env::var("LMSTUDIO_MODEL").unwrap_or_else(|_| "default".to_string());
            let config = ProviderConfig {
                provider_type: LlmProviderType::LmStudio,
                base_url: url,
                api_key: None,
                default_model,
                enabled: true,
            };
            match create_provider(&config) {
                Ok(provider) => {
                    tracing::info!("Registered LM Studio provider");
                    if first_provider_id.is_none() {
                        first_provider_id = Some("lmstudio".to_string());
                    }
                    registry.register("lmstudio", config, provider);
                },
                Err(e) => {
                    tracing::warn!("Failed to create LM Studio provider: {}", e)
                },
            }
        }
    }

    // LlamaCpp (native GGUF)
    #[cfg(feature = "native-llm")]
    if let Ok(model_path) = std::env::var("LLAMACPP_MODEL") {
        if !model_path.is_empty() {
            match llm::LlamaCppProvider::new(&model_path, model_manager.clone(), &hardware).await {
                Ok(provider) => {
                    tracing::info!("Registered LlamaCpp provider (model: {})", model_path);
                    let config = ProviderConfig {
                        provider_type: LlmProviderType::LlamaCpp,
                        base_url: "native".to_string(),
                        api_key: None,
                        default_model: model_path,
                        enabled: true,
                    };
                    if first_provider_id.is_none() {
                        first_provider_id = Some("llamacpp".to_string());
                    }
                    registry.register("llamacpp", config, Box::new(provider));
                },
                Err(e) => {
                    tracing::warn!("Failed to create LlamaCpp provider: {}", e);
                },
            }
        }
    }

    // Resolve default
    if registry.get_default().is_err() {
        if let Some(fallback) = first_provider_id {
            tracing::info!(
                "Default provider '{}' not available, falling back to '{}'",
                requested_default,
                fallback
            );
            registry.set_default(fallback);
        }
    }

    if registry.is_empty() {
        tracing::warn!(
            "No LLM providers configured! Set VLLM_URL, LMSTUDIO_URL, \
             OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, \
             OLLAMA_URL, or LLAMACPP_MODEL."
        );
    } else {
        tracing::info!(
            "Provider registry ready: {} provider(s), default='{}'",
            registry.list_providers().len(),
            registry.default_provider_id()
        );
    }

    let providers = Arc::new(registry);

    // Initialize RAG pipeline
    let rag = RagPipeline::new(embeddings.clone(), vectors.clone(), Arc::clone(&providers));
    tracing::info!("RAG pipeline initialized");

    // Initialize index pipeline
    let ocr_url = std::env::var("OCR_URL").ok().filter(|u| !u.is_empty());
    let indexer = IndexPipeline::new(embeddings.clone(), vectors.clone(), ocr_url);
    tracing::info!("Index pipeline initialized");

    // JWT configuration (custom: audience="signapps" for all services)
    let jwt_config = JwtConfig {
        secret: config.jwt_secret.clone(),
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // Initialize model orchestrator and gateway router
    let orchestrator = Arc::new(ModelOrchestrator::new(
        model_manager.clone(),
        hardware.clone(),
    ));
    let gateway = Arc::new(GatewayRouter::new(orchestrator));
    tracing::info!("Gateway router initialized");

    // Register all workers based on environment variables
    let registered = register_workers(&gateway).await;

    // Initialize multimodal indexer with optional vision and multimodal embed workers
    let mut mm_indexer = MultimodalIndexer::new(
        embeddings.clone(),
        vectors.clone(),
        pool.clone(),
        TextChunker::new(),
    );
    if let Some(embed) = registered.mm_embed {
        mm_indexer = mm_indexer.with_multimodal_embed(embed);
        tracing::info!("MultimodalIndexer: multimodal embeddings enabled");
    }
    if let Some(vis) = registered.vision {
        mm_indexer = mm_indexer.with_vision(vis);
        tracing::info!("MultimodalIndexer: vision descriptions enabled");
    }
    let mm_indexer = Arc::new(mm_indexer);

    // Create application state
    let state = AppState {
        pool: pool.clone(),
        vectors: vectors.clone(),
        embeddings: embeddings.clone(),
        providers,
        storage: storage.clone(),
        rag,
        indexer,
        jwt_config,
        model_manager: Some(model_manager),
        hardware: Some(hardware),
        gateway: Some(gateway),
        mm_indexer: Some(mm_indexer.clone()),
    };

    // Start background circular pipeline (auto-indexes generated media)
    let circular = Arc::new(CircularPipeline::new(mm_indexer, pool, storage));
    circular.start();
    tracing::info!("Circular pipeline started");

    // Build router
    let app = create_router(state);

    // Start server using bootstrap helper
    signapps_common::bootstrap::run_server(app, &config).await
}

/// Workers returned from registration that are also needed by the multimodal indexer.
struct RegisteredWorkers {
    mm_embed: Option<Arc<dyn MultimodalEmbedWorker>>,
    vision: Option<Arc<dyn VisionWorker>>,
}

/// Register AI workers into the gateway based on environment variables.
///
/// Each worker type supports both HTTP (self-hosted) and cloud variants.
/// Workers are only registered when the corresponding env var is set.
///
/// Returns references to the multimodal embed and vision workers so they
/// can also be wired into the [`MultimodalIndexer`].
async fn register_workers(gateway: &GatewayRouter) -> RegisteredWorkers {
    let mut mm_embed_worker: Option<Arc<dyn MultimodalEmbedWorker>> = None;
    let mut vision_worker: Option<Arc<dyn VisionWorker>> = None;
    // -----------------------------------------------------------------------
    // Native workers (cfg-gated) — registered first so the gateway router
    // prefers them over HTTP/Cloud backends (Native > Http > Cloud priority).
    // -----------------------------------------------------------------------

    // === Native Reranker (ONNX) ===
    #[cfg(feature = "native-reranker")]
    {
        let model_path = std::env::var("RERANKER_ONNX_MODEL")
            .unwrap_or_else(|_| "data/models/reranker/model.onnx".into());
        let tokenizer_path = std::env::var("RERANKER_ONNX_TOKENIZER")
            .unwrap_or_else(|_| "data/models/reranker/tokenizer.json".into());
        match workers::reranker::NativeReranker::new(&model_path, &tokenizer_path) {
            Ok(worker) => {
                gateway.register(Arc::new(worker)).await;
                tracing::info!("Registered native ONNX reranker");
            },
            Err(e) => tracing::warn!("Failed to load native reranker: {}", e),
        }
    }

    // === Native Multimodal Embeddings (SigLIP ONNX) ===
    #[cfg(feature = "native-embedmm")]
    {
        let text_model = std::env::var("SIGLIP_TEXT_MODEL")
            .unwrap_or_else(|_| "data/models/siglip/text_model.onnx".into());
        let vision_model = std::env::var("SIGLIP_VISION_MODEL")
            .unwrap_or_else(|_| "data/models/siglip/vision_model.onnx".into());
        let tokenizer = std::env::var("SIGLIP_TOKENIZER")
            .unwrap_or_else(|_| "data/models/siglip/tokenizer.json".into());
        let dim: usize = std::env::var("SIGLIP_DIM")
            .ok()
            .and_then(|d| d.parse().ok())
            .unwrap_or(1024);
        match workers::embeddings_mm::NativeSigLIP::new(&text_model, &vision_model, &tokenizer, dim)
        {
            Ok(worker) => {
                let worker = Arc::new(worker);
                mm_embed_worker = Some(worker.clone() as Arc<dyn MultimodalEmbedWorker>);
                gateway.register(worker as Arc<dyn AiWorker>).await;
                tracing::info!("Registered native SigLIP embeddings");
            },
            Err(e) => tracing::warn!("Failed to load native SigLIP: {}", e),
        }
    }

    // === Native Vision (llama.cpp multimodal) ===
    #[cfg(feature = "native-vision")]
    {
        if let Ok(model_path) = std::env::var("VISION_GGUF_MODEL") {
            let ctx_size: u32 = std::env::var("VISION_CONTEXT_SIZE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(4096);
            let gpu_layers: i32 = std::env::var("VISION_GPU_LAYERS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(-1);
            let worker = Arc::new(workers::vision::NativeVision::new(
                &model_path,
                ctx_size,
                gpu_layers,
            ));
            vision_worker = Some(worker.clone() as Arc<dyn VisionWorker>);
            gateway.register(worker as Arc<dyn AiWorker>).await;
            tracing::info!("Registered native vision (llama.cpp)");
        }
    }

    // === Native Image Generation (candle) ===
    #[cfg(feature = "native-imagegen")]
    {
        if let Ok(model_path) = std::env::var("IMAGEGEN_MODEL_PATH") {
            let model_type_str =
                std::env::var("IMAGEGEN_MODEL_TYPE").unwrap_or_else(|_| "sdxl".into());
            let model_type = match model_type_str.as_str() {
                "sd15" => workers::imagegen::native::DiffusionModelType::StableDiffusion15,
                "sdxl" => workers::imagegen::native::DiffusionModelType::StableDiffusionXL,
                "flux-schnell" => workers::imagegen::native::DiffusionModelType::Flux1Schnell,
                "flux-dev" => workers::imagegen::native::DiffusionModelType::Flux1Dev,
                _ => workers::imagegen::native::DiffusionModelType::StableDiffusionXL,
            };
            let worker = workers::imagegen::NativeImageGen::new(
                std::path::PathBuf::from(model_path),
                model_type,
            );
            gateway.register(Arc::new(worker)).await;
            tracing::info!("Registered native image generation (candle)");
        }
    }

    // -----------------------------------------------------------------------
    // HTTP and Cloud workers — registered after native so the router
    // uses them as fallbacks.
    // -----------------------------------------------------------------------

    // === Reranker ===
    if let Ok(url) = std::env::var("RERANKER_URL") {
        let model = std::env::var("RERANKER_MODEL").unwrap_or_else(|_| "default".into());
        let worker = Arc::new(workers::reranker::HttpReranker::new(&url, &model));
        gateway.register(worker).await;
    }
    if let Ok(api_key) = std::env::var("COHERE_API_KEY") {
        let worker = Arc::new(workers::reranker::CloudReranker::new(&api_key, None));
        gateway.register(worker).await;
    }

    // === Multimodal Embeddings ===
    if let Ok(url) = std::env::var("MULTIMODAL_EMBED_URL") {
        let model = std::env::var("MULTIMODAL_EMBED_MODEL").unwrap_or_else(|_| "siglip".into());
        let dim = std::env::var("MULTIMODAL_EMBED_DIM")
            .ok()
            .and_then(|d| d.parse().ok())
            .unwrap_or(1024);
        let worker = Arc::new(workers::embeddings_mm::HttpMultimodalEmbed::new(
            &url, &model, dim,
        ));
        if mm_embed_worker.is_none() {
            mm_embed_worker = Some(worker.clone() as Arc<dyn MultimodalEmbedWorker>);
        }
        gateway.register(worker as Arc<dyn AiWorker>).await;
    }
    if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
        let worker = Arc::new(workers::embeddings_mm::CloudMultimodalEmbed::new(
            &api_key, None,
        ));
        if mm_embed_worker.is_none() {
            mm_embed_worker = Some(worker.clone() as Arc<dyn MultimodalEmbedWorker>);
        }
        gateway.register(worker as Arc<dyn AiWorker>).await;
    }

    // === Vision ===
    if let Ok(url) = std::env::var("VISION_URL") {
        let model = std::env::var("VISION_MODEL").unwrap_or_else(|_| "default".into());
        let worker = Arc::new(workers::vision::HttpVision::new(&url, &model));
        if vision_worker.is_none() {
            vision_worker = Some(worker.clone() as Arc<dyn VisionWorker>);
        }
        gateway.register(worker as Arc<dyn AiWorker>).await;
    }
    if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
        let worker = Arc::new(workers::vision::CloudVision::new(&api_key, None));
        if vision_worker.is_none() {
            vision_worker = Some(worker.clone() as Arc<dyn VisionWorker>);
        }
        gateway.register(worker as Arc<dyn AiWorker>).await;
    }

    // === Image Generation ===
    if let Ok(url) = std::env::var("IMAGEGEN_URL") {
        let model = std::env::var("IMAGEGEN_MODEL").unwrap_or_else(|_| "default".into());
        let worker = Arc::new(workers::imagegen::HttpImageGen::new(&url, &model));
        gateway.register(worker).await;
    }
    if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
        let model = std::env::var("IMAGEGEN_CLOUD_MODEL").unwrap_or_else(|_| "dall-e-3".into());
        let worker = Arc::new(workers::imagegen::CloudImageGen::new(
            &api_key,
            Some(&model),
        ));
        gateway.register(worker).await;
    }

    // === Video Generation ===
    if let Ok(url) = std::env::var("VIDEOGEN_URL") {
        let model = std::env::var("VIDEOGEN_MODEL").unwrap_or_else(|_| "default".into());
        let worker = Arc::new(workers::videogen::HttpVideoGen::new(&url, &model));
        gateway.register(worker).await;
    }
    if let Ok(api_key) = std::env::var("REPLICATE_API_KEY") {
        let model =
            std::env::var("VIDEOGEN_CLOUD_MODEL").unwrap_or_else(|_| "minimax/video-01".into());
        let worker = Arc::new(workers::videogen::CloudVideoGen::new(
            &api_key,
            Some(&model),
        ));
        gateway.register(worker).await;
    }

    // === Video Understanding ===
    if let Ok(url) = std::env::var("VIDEO_UNDERSTAND_URL") {
        let worker = Arc::new(workers::video_understand::HttpVideoUnderstand::new(&url));
        gateway.register(worker).await;
    }
    if let Ok(api_key) = std::env::var("GEMINI_API_KEY") {
        let model = std::env::var("GEMINI_MODEL").unwrap_or_else(|_| "gemini-1.5-pro".into());
        let worker = Arc::new(workers::video_understand::CloudVideoUnderstand::new(
            &api_key,
            Some(&model),
        ));
        gateway.register(worker).await;
    }

    // === Audio Generation ===
    if let Ok(url) = std::env::var("AUDIOGEN_URL") {
        let model = std::env::var("AUDIOGEN_MODEL").unwrap_or_else(|_| "default".into());
        let worker = Arc::new(workers::audiogen::HttpAudioGen::new(&url, &model));
        gateway.register(worker).await;
    }
    if let Ok(api_key) = std::env::var("REPLICATE_API_KEY") {
        let model =
            std::env::var("AUDIOGEN_CLOUD_MODEL").unwrap_or_else(|_| "meta/musicgen:large".into());
        let worker = Arc::new(workers::audiogen::CloudAudioGen::new(
            &api_key,
            Some(&model),
        ));
        gateway.register(worker).await;
    }

    // === Document Parsing ===
    let ocr_url = std::env::var("OCR_URL").ok();
    let worker = Arc::new(workers::docparse::NativeDocParse::new(ocr_url));
    gateway.register(worker).await;

    if let (Ok(endpoint), Ok(key)) = (
        std::env::var("AZURE_DOC_ENDPOINT"),
        std::env::var("AZURE_DOC_KEY"),
    ) {
        let worker = Arc::new(workers::docparse::CloudDocParse::new(&endpoint, &key));
        gateway.register(worker).await;
    }

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    let caps = gateway.list_capabilities().await;
    let available: Vec<_> = caps.iter().filter(|c| c.available).collect();
    tracing::info!(
        "Gateway initialized: {}/{} capabilities available ({} backends total)",
        available.len(),
        caps.len(),
        caps.iter().map(|c| c.backends.len()).sum::<usize>()
    );
    for cap in &available {
        tracing::info!(
            "  {:?}: {} backend(s), quality={:.0}%{}",
            cap.capability,
            cap.backends.len(),
            cap.local_quality * 100.0,
            if cap.upgrade_recommended {
                " [cloud upgrade recommended]"
            } else {
                ""
            }
        );
    }

    RegisteredWorkers {
        mm_embed: mm_embed_worker,
        vision: vision_worker,
    }
}

/// Create the application router with all routes.
fn create_router(state: AppState) -> Router {
    // Public routes (health check)
    let public_routes = Router::new().route("/health", get(health::health_check));

    // Protected AI routes
    let ai_routes = Router::new()
        // Search
        .route("/search", get(search::search))
        .route("/search/image", post(search_image::search_by_image))
        // Chat
        .route("/chat", post(chat::chat))
        .route("/chat/stream", post(chat::chat_stream))
        // Conversations
        .route(
            "/conversations",
            get(conversations::list_conversations),
        )
        .route(
            "/conversations/:id",
            get(conversations::get_conversation)
                .delete(conversations::delete_conversation),
        )
        // AQ-AITR: whisper-rs meeting transcription
        .route("/transcribe", post(transcription::transcribe_audio))
        // Vision
        .route("/vision/describe", post(vision::describe_image))
        .route("/vision/vqa", post(vision::visual_qa))
        .route("/vision/batch", post(vision::batch_describe))
        // Document parsing
        .route("/document/parse", post(doc_parse::parse_document))
        .route("/document/tables", post(doc_parse::extract_tables))
        // Image generation
        .route("/image/generate", post(image_gen::generate_image))
        .route("/image/inpaint", post(image_gen::inpaint_image))
        .route("/image/img2img", post(image_gen::img2img))
        .route("/image/upscale", post(image_gen::upscale_image))
        .route("/image/models", get(image_gen::list_image_models))
        // Video generation & understanding
        .route("/video/generate", post(video::generate_video))
        .route("/video/img2video", post(video::img_to_video))
        .route("/video/analyze", post(video::analyze_video))
        .route("/video/extract-frames", post(video::extract_frames))
        .route("/video/transcribe", post(video::transcribe_video))
        .route("/video/models", get(video::list_models))
        // Audio generation
        .route("/audio/music", post(audio_gen::generate_music))
        .route("/audio/sfx", post(audio_gen::generate_sfx))
        .route("/audio/models", get(audio_gen::list_models))
        // Action Execution
        .route("/action", post(action::execute_action))
        // Index
        .route("/index", post(index::index_document))
        .route("/index/:document_id", delete(index::remove_document))
        .route("/stats", get(index::get_stats))
        // Universal Webhook Memory
        .route("/webhook/:source_type", post(webhook::ingest_webhook))
        // Collections
        .route(
            "/collections",
            get(collections::list_collections)
                .post(collections::create_collection),
        )
        .route(
            "/collections/:name",
            get(collections::get_collection)
                .delete(collections::delete_collection),
        )
        .route(
            "/collections/:name/stats",
            get(collections::get_collection_stats),
        )
        // Models & Providers
        .route("/models", get(model_handlers::list_models))
        .route("/providers", get(providers::list_providers))
        // Model management
        .route("/models/local", get(model_management::list_local_models))
        .route(
            "/models/available",
            get(model_management::list_available_models),
        )
        .route("/models/search", get(model_management::search_models))
        .route("/models/download", post(model_management::download_model))
        .route(
            "/models/:model_id",
            get(model_management::get_model_status)
                .delete(model_management::delete_model),
        )
        .route("/hardware", get(model_management::get_hardware))
        // Gateway: capabilities & GPU status
        .route(
            "/capabilities",
            get(capabilities::list_capabilities),
        )
        .route(
            "/capabilities/:cap",
            get(capabilities::get_capability_advice),
        )
        .route("/gpu/status", get(gpu_status::get_gpu_status))
        .route("/gpu/profiles", get(gpu_status::list_profiles))
        .route(
            "/models/recommended",
            get(gpu_status::get_recommended_models),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Admin routes
    let admin_routes = Router::new()
        .route("/reindex", post(index::reindex_all))
        .route_layer(middleware::from_fn(require_admin))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Internal routes (no auth needed, only callable from internal VPN/Docker)
    let internal_routes = Router::new()
        .route("/index", post(index::index_internal_document))
        .route("/index/:document_id", post(index::index_direct_document))
        .route("/index/:document_id", delete(index::remove_document));

    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().unwrap(),
            "http://127.0.0.1:3000".parse().unwrap(),
        ]))
        .allow_credentials(true)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::ORIGIN,
            axum::http::HeaderName::from_static("x-workspace-id"),
            axum::http::HeaderName::from_static("x-request-id"),
        ]);

    // Combine all routes
    Router::new()
        .nest("/api/v1", public_routes)
        .nest("/api/v1/internal", internal_routes)
        .nest("/api/v1/ai", ai_routes)
        .nest("/api/v1/admin/ai", admin_routes)
        .layer(
            ServiceBuilder::new()
                .layer(middleware::from_fn(request_id_middleware))
                .layer(middleware::from_fn(logging_middleware))
                .layer(cors),
        )
        .layer(axum::extract::DefaultBodyLimit::max(100 * 1024 * 1024)) // 100MB for AI document ingestion
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_clone() {
        fn assert_clone<T: Clone>() {}
        assert_clone::<AppState>();
    }
}
