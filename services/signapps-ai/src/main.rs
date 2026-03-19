//! SignApps AI Service - RAG and LLM integration
//!

use axum::{
    middleware,
    routing::{delete, get, post},
    Router,
};
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
use tower_http::cors::{Any, CorsLayer};

mod embeddings;
mod handlers;
mod indexer;
mod llm;
mod rag;
mod vectors;

use embeddings::EmbeddingsClient;
use handlers::{
    action, chat, collections, health, index, model_management, models, providers, search, webhook,
};
use indexer::IndexPipeline;
use llm::{create_provider, LlmProviderType, ProviderConfig, ProviderRegistry};
use rag::RagPipeline;
use vectors::VectorService;

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
        let root = env_or("STORAGE_ROOT", "/data/signapps");
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

    // Create application state
    let state = AppState {
        pool,
        vectors,
        embeddings,
        providers,
        storage,
        rag,
        indexer,
        jwt_config,
        model_manager: Some(model_manager),
        hardware: Some(hardware),
    };

    // Build router
    let app = create_router(state);

    // Start server using bootstrap helper
    signapps_common::bootstrap::run_server(app, &config).await
}

/// Create the application router with all routes.
fn create_router(state: AppState) -> Router {
    // Public routes (health check)
    let public_routes = Router::new().route("/health", get(health::health_check));

    // Protected AI routes
    let ai_routes = Router::new()
        // Search
        .route("/search", get(search::search))
        // Chat
        .route("/chat", post(chat::chat))
        .route("/chat/stream", post(chat::chat_stream))
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
        .route("/models", get(models::list_models))
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
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

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
