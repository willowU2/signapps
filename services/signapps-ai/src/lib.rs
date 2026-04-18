//! Public library interface for the AI service.
//!
//! Exposes [`router`] so the single-binary runtime can mount the AI
//! routes under `:3005` without owning its own pool, keystore, or JWT
//! config.
//!
//! The legacy binary at `src/main.rs` still wires this library into a
//! standalone Axum server for `just start-legacy` and targeted debugging
//! workflows.
//!
//! # Lazy initialization
//!
//! Heavy subsystems (hardware detection, model manager, provider
//! registry) are deferred to the first HTTP request via
//! [`tokio::sync::OnceCell`] so that the single-binary boot does not
//! pay the ~5 s cost of GPU probing.  See [`providers::lazy`] for
//! details.

#![allow(dead_code, unused_imports, clippy::incompatible_msrv)]

pub mod embeddings;
pub mod gateway;
pub mod handlers;
pub mod indexer;
pub mod injection_guard;
pub mod llm;
pub mod memory;
pub mod models;
pub mod rag;
pub mod tools;
pub mod vectors;
pub mod workers;

use std::sync::Arc;

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
use signapps_service::shared_state::SharedState;
use tokio::sync::OnceCell;
use tower::ServiceBuilder;
use tower_http::cors::{AllowOrigin, CorsLayer};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use embeddings::EmbeddingsClient;
use handlers::openapi::AiApiDoc;
use handlers::{chat, collections, health, index, lightrag, model_management, providers, search};
use indexer::IndexPipeline;
use llm::ProviderRegistry;
use rag::RagPipeline;
use tools::{ServiceClients, ServiceEndpoints, ToolExecutor};
use vectors::VectorService;

/// Re-export of the lazy initializer for heavy AI subsystems.
///
/// See [`llm::lazy::ensure_initialized`] for details.
pub use llm::lazy as providers_lazy;

/// Application state shared across handlers.
///
/// Fields fall into three categories:
///
/// - **Light (eagerly constructed)**: `pool`, `vectors`, `embeddings`,
///   `jwt_config`, `storage`, `providers`, `rag`, `indexer`,
///   `tool_executor`.  These wrap HTTP clients, database handles, or
///   small HashMaps and are cheap to build (< 50 ms total).
/// - **Heavy (lazily constructed on first request)**: `hardware` and
///   `model_manager`.  Hardware detection probes GPUs via
///   `nvidia-smi` / `rocm-smi` / Windows WMI and can take several
///   seconds.  Both are wrapped in an [`OnceCell`] stored on
///   [`providers::lazy::ensure_hardware_manager`].
/// - **Optional**: `gateway` remains `None` until the multimodal
///   gateway is wired (Task 23+).
#[derive(Clone)]
pub struct AppState {
    /// Shared Postgres connection pool.
    pub pool: DatabasePool,
    /// Vector store (pgvector) wrapper.
    pub vectors: VectorService,
    /// Text embeddings HTTP client (TEI).
    pub embeddings: EmbeddingsClient,
    /// LLM provider registry (vLLM, Ollama, OpenAI, Anthropic, LlamaCpp).
    pub providers: Arc<ProviderRegistry>,
    /// Retrieval-Augmented Generation pipeline.
    pub rag: RagPipeline,
    /// Document indexing pipeline.
    pub indexer: IndexPipeline,
    /// Full JWT configuration (algorithm, keys, issuer, audience, TTLs).
    pub jwt_config: JwtConfig,
    /// Tool calling executor (93 tools across 15 services).
    pub tool_executor: ToolExecutor,
    /// Optional multimodal gateway (wired by Task 23+).
    pub gateway: Option<Arc<crate::gateway::GatewayRouter>>,
    /// OpenDAL storage operator for document ingestion.
    pub storage: opendal::Operator,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

/// Build the AI router using the shared runtime state.
///
/// # Errors
///
/// Returns an error when any lightweight subsystem fails to construct
/// (e.g. opendal operator build, TEI client, pgvector pool wrap).
///
/// # Examples
///
/// ```no_run
/// use signapps_service::shared_state::SharedState;
///
/// # async fn demo() -> anyhow::Result<()> {
/// let shared = SharedState::init_once().await?;
/// let _router = signapps_ai::router(shared).await?;
/// # Ok(())
/// # }
/// ```
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;
    tracing::info!("signapps-ai router built");
    Ok(create_router(state))
}

/// Build the service-specific `AppState` from shared runtime resources.
///
/// Only lightweight subsystems are constructed here. Provider registry,
/// RAG pipeline, and tool executor are assembled synchronously (they
/// wrap HTTP clients or HashMaps). Hardware detection and model
/// manager are deferred to [`providers::lazy`].
async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    // ─── Vectors / Embeddings (light) ─────────────────────────────────
    let vectors = VectorService::new(shared.pool.clone());
    let embeddings_url =
        std::env::var("EMBEDDINGS_URL").unwrap_or_else(|_| "http://localhost:8080".into());
    let embeddings = EmbeddingsClient::new(&embeddings_url);

    // ─── Provider registry (light: HTTP clients + HashMap) ────────────
    let providers = Arc::new(build_provider_registry());

    // ─── RAG + Index pipelines (light wrappers) ───────────────────────
    let rag = RagPipeline::new(embeddings.clone(), vectors.clone(), Arc::clone(&providers));

    let ocr_url = std::env::var("OCR_URL").ok().filter(|u| !u.is_empty());
    let indexer = IndexPipeline::new(embeddings.clone(), vectors.clone(), ocr_url);

    // ─── Storage (opendal) ────────────────────────────────────────────
    let storage_root = std::env::var("STORAGE_ROOT").unwrap_or_else(|_| "./data/storage".into());
    let builder = opendal::services::Fs::default().root(&storage_root);
    let storage = opendal::Operator::new(builder)?.finish();

    // ─── Tool executor (ToolRegistry is lazy via once_cell::sync::Lazy).
    let service_endpoints = ServiceEndpoints::from_env();
    let service_clients = ServiceClients::new(service_endpoints);
    let tool_executor = ToolExecutor::new(crate::tools::registry::lazy_registry(), service_clients);

    Ok(AppState {
        pool: shared.pool.clone(),
        vectors,
        embeddings,
        providers,
        rag,
        indexer,
        jwt_config: (*shared.jwt).clone(),
        tool_executor,
        gateway: None,
        storage,
    })
}

/// Build the provider registry from environment variables.
///
/// Creates provider instances synchronously; HTTP clients are
/// constructed lazily on first request so this never blocks.
fn build_provider_registry() -> ProviderRegistry {
    use crate::llm::{create_provider, LlmProviderType, ProviderConfig};

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
            if let Ok(provider) = create_provider(&config) {
                tracing::info!("Registered vLLM provider");
                if first_provider_id.is_none() {
                    first_provider_id = Some("vllm".to_string());
                }
                registry.register("vllm", config, provider);
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
            if let Ok(provider) = create_provider(&config) {
                tracing::info!("Registered Ollama provider");
                if first_provider_id.is_none() {
                    first_provider_id = Some("ollama".to_string());
                }
                registry.register("ollama", config, provider);
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
            if let Ok(provider) = create_provider(&config) {
                tracing::info!("Registered OpenAI provider");
                if first_provider_id.is_none() {
                    first_provider_id = Some("openai".to_string());
                }
                registry.register("openai", config, provider);
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
            if let Ok(provider) = create_provider(&config) {
                tracing::info!("Registered Anthropic provider");
                if first_provider_id.is_none() {
                    first_provider_id = Some("anthropic".to_string());
                }
                registry.register("anthropic", config, provider);
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
            "No LLM providers configured. Set VLLM_URL, OLLAMA_URL, \
             OPENAI_API_KEY, or ANTHROPIC_API_KEY."
        );
    } else {
        tracing::info!(
            "Provider registry ready: {} provider(s), default='{}'",
            registry.list_providers().len(),
            registry.default_provider_id()
        );
    }

    registry
}

/// Create the application router with all routes.
pub fn create_router(state: AppState) -> Router {
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
            get(collections::list_collections).post(collections::create_collection),
        )
        .route(
            "/collections/:name",
            get(collections::get_collection).delete(collections::delete_collection),
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
            get(model_management::get_model_status).delete(model_management::delete_model),
        )
        .route("/hardware", get(model_management::get_hardware))
        // LightRAG knowledge graph
        .route("/lightrag/index", post(lightrag::lightrag_index))
        .route("/lightrag/query", post(lightrag::lightrag_query))
        .route("/lightrag/stats", get(lightrag::lightrag_stats))
        .route("/lightrag/seed", post(lightrag::lightrag_seed))
        .route("/lightrag/communities", post(lightrag::lightrag_communities))
        .route("/lightrag/graph", get(lightrag::lightrag_graph))
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
