//! SignApps AI Service - RAG and LLM integration
#![allow(dead_code, unused_imports, clippy::incompatible_msrv)]

use axum::{
    middleware,
    routing::{delete, get, post},
    Router,
};
use signapps_common::middleware::{
    auth_middleware, logging_middleware, request_id_middleware, require_admin,
    tenant_context_middleware,
};
use signapps_common::{AuthState, JwtConfig};
use signapps_db::DatabasePool;
use signapps_runtime::{HardwareProfile, ModelManager};
use std::net::SocketAddr;
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::cors::{AllowOrigin, CorsLayer};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

mod embeddings;
mod gateway;
mod handlers;
mod indexer;
mod injection_guard;
mod llm;
mod memory;
mod models;
mod rag;
mod tools;
mod vectors;
mod workers;

use embeddings::EmbeddingsClient;
use handlers::openapi::AiApiDoc;
use handlers::{chat, collections, health, index, lightrag, model_management, providers, search};
use indexer::IndexPipeline;
use llm::{create_provider, LlmProviderType, ProviderConfig, ProviderRegistry};
use rag::RagPipeline;
use tools::{ServiceClients, ServiceEndpoints, ToolExecutor, ToolRegistry};
use vectors::VectorService;

/// Application state shared across handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub vectors: VectorService,
    pub embeddings: EmbeddingsClient,
    pub providers: Arc<ProviderRegistry>,
    pub rag: RagPipeline,
    pub indexer: IndexPipeline,
    pub jwt_config: JwtConfig,
    pub model_manager: Option<Arc<ModelManager>>,
    pub hardware: Option<HardwareProfile>,
    pub tool_executor: ToolExecutor,
    pub gateway: Option<Arc<crate::gateway::GatewayRouter>>,
    pub storage: opendal::Operator,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "signapps_ai=debug,tower_http=debug,info".into()),
        )
        .init();

    tracing::info!(
        "Starting SignApps AI Service v{}",
        env!("CARGO_PKG_VERSION")
    );

    // Load .env file
    dotenvy::dotenv().ok();

    // Load configuration
    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://localhost/signapps".into());
    let embeddings_url =
        std::env::var("EMBEDDINGS_URL").unwrap_or_else(|_| "http://localhost:8080".into());

    // Initialize database pool
    let pool = signapps_db::create_pool(&database_url).await?;
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
                .unwrap_or_else(|_| "claude-3-5-sonnet-20241022".to_string());
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
            "No LLM providers configured! Set VLLM_URL, OLLAMA_URL, \
             OPENAI_API_KEY, ANTHROPIC_API_KEY, or LLAMACPP_MODEL."
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

    // JWT config — auto-detects RS256 or HS256 from environment
    let jwt_config = JwtConfig::from_env();

    let storage_root = std::env::var("STORAGE_ROOT").unwrap_or_else(|_| "./data/storage".into());
    let builder = opendal::services::Fs::default().root(&storage_root);
    let storage = opendal::Operator::new(builder)
        .expect("valid opendal filesystem operator")
        .finish();

    // Initialize tool calling system
    let service_endpoints = ServiceEndpoints::from_env();
    let service_clients = ServiceClients::new(service_endpoints);
    let tool_registry = ToolRegistry::new();
    tracing::info!(
        "Tool registry initialized: {} tools available",
        tool_registry.len()
    );
    let tool_executor = ToolExecutor::new(tool_registry, service_clients);

    // Create application state
    let state = AppState {
        pool,
        vectors,
        embeddings,
        providers,
        rag,
        indexer,
        jwt_config,
        model_manager: Some(model_manager),
        hardware: Some(hardware),
        tool_executor,
        gateway: None,
        storage,
    };

    // Build router
    let app = create_router(state);

    // Start server with graceful shutdown
    let port: u16 = std::env::var("SERVER_PORT")
        .unwrap_or_else(|_| "3005".into())
        .parse()
        .unwrap_or(3005);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(signapps_common::graceful_shutdown())
        .await?;

    Ok(())
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
        // Index
        .route("/index", post(index::index_document))
        .route("/index/:document_id", delete(index::remove_document))
        .route("/stats", get(index::get_stats))
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
        .route("/models", get(handlers::models::list_models))
        .route("/providers", get(providers::list_providers))
        // Model management
        .route("/models/local", get(model_management::list_local_models))
        .route(
            "/models/available",
            get(model_management::list_available_models),
        )
        .route("/models/download", post(model_management::download_model))
        .route(
            "/models/:model_id",
            get(model_management::get_model_status)
                .delete(model_management::delete_model),
        )
        .route("/hardware", get(model_management::get_hardware))
        // LightRAG knowledge graph
        .route(
            "/lightrag/index",
            post(lightrag::lightrag_index),
        )
        .route(
            "/lightrag/query",
            post(lightrag::lightrag_query),
        )
        .route(
            "/lightrag/stats",
            get(lightrag::lightrag_stats),
        )
        .route(
            "/lightrag/seed",
            post(lightrag::lightrag_seed),
        )
        .route(
            "/lightrag/communities",
            post(lightrag::lightrag_communities),
        )
        .route(
            "/lightrag/graph",
            get(lightrag::lightrag_graph),
        )
        .route_layer(middleware::from_fn(tenant_context_middleware))
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

    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().expect("valid CORS origin"),
            "http://127.0.0.1:3000".parse().expect("valid CORS origin"),
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

    // Root-level health check (outside /api/v1 nest so it's reachable at /health)
    let root_health = Router::new().route("/health", get(health::health_check));

    // OpenAPI / Swagger UI
    let openapi_routes =
        SwaggerUi::new("/swagger-ui").url("/api/v1/openapi.json", AiApiDoc::openapi());

    // Combine all routes
    Router::new()
        .merge(root_health)
        .merge(openapi_routes)
        .merge(signapps_common::version::router("signapps-ai"))
        .nest("/api/v1", public_routes)
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
