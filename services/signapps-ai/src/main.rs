//! SignApps AI Service - RAG and LLM integration

use axum::{
    middleware,
    routing::{delete, get, post},
    Router,
};
use signapps_common::middleware::{
    auth_middleware, logging_middleware, request_id_middleware, require_admin,
};
use signapps_common::{AuthState, JwtConfig};
use signapps_db::DatabasePool;
use std::net::SocketAddr;
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::cors::{Any, CorsLayer};

mod embeddings;
mod handlers;
mod llm;
mod qdrant;
mod rag;

use embeddings::EmbeddingsClient;
use handlers::{chat, health, index, models, providers, search};
use llm::{
    create_provider, LlmProviderType, ProviderConfig, ProviderRegistry,
};
use qdrant::QdrantService;
use rag::RagPipeline;

/// Application state shared across handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub qdrant: QdrantService,
    pub embeddings: EmbeddingsClient,
    pub providers: Arc<ProviderRegistry>,
    pub rag: RagPipeline,
    pub jwt_config: JwtConfig,
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
    let jwt_secret =
        std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".into());
    let qdrant_url =
        std::env::var("QDRANT_URL").unwrap_or_else(|_| "http://localhost:6334".into());
    let embeddings_url =
        std::env::var("EMBEDDINGS_URL").unwrap_or_else(|_| "http://localhost:8080".into());

    // Initialize database pool
    let pool = signapps_db::create_pool(&database_url).await?;
    tracing::info!("Database connection established");

    // Run migrations
    signapps_db::run_migrations(&pool).await?;
    tracing::info!("Database migrations completed");

    // Initialize clients
    let qdrant = QdrantService::new(&qdrant_url).await?;
    tracing::info!("Qdrant client initialized");

    let embeddings = EmbeddingsClient::new(&embeddings_url);
    tracing::info!("Embeddings client initialized");

    // Build provider registry from environment variables
    let requested_default =
        std::env::var("LLM_PROVIDER").unwrap_or_default();
    let mut registry =
        ProviderRegistry::new(requested_default.clone());
    let mut first_provider_id: Option<String> = None;

    // Helper macro would be nice, but let's keep it explicit.

    // vLLM
    if let Ok(url) = std::env::var("VLLM_URL") {
        if !url.is_empty() {
            let default_model = std::env::var("VLLM_MODEL")
                .or_else(|_| std::env::var("DEFAULT_MODEL"))
                .unwrap_or_else(|_| {
                    "meta-llama/Llama-3.2-3B-Instruct".to_string()
                });
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
                }
                Err(e) => {
                    tracing::warn!("Failed to create vLLM provider: {}", e)
                }
            }
        }
    }

    // Ollama
    if let Ok(url) = std::env::var("OLLAMA_URL") {
        if !url.is_empty() {
            let default_model = std::env::var("OLLAMA_MODEL")
                .unwrap_or_else(|_| "llama3.2:3b".to_string());
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
                        first_provider_id =
                            Some("ollama".to_string());
                    }
                    registry.register("ollama", config, provider);
                }
                Err(e) => {
                    tracing::warn!(
                        "Failed to create Ollama provider: {}",
                        e
                    )
                }
            }
        }
    }

    // OpenAI
    if let Ok(key) = std::env::var("OPENAI_API_KEY") {
        if !key.is_empty() {
            let default_model = std::env::var("OPENAI_MODEL")
                .unwrap_or_else(|_| "gpt-4o-mini".to_string());
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
                        first_provider_id =
                            Some("openai".to_string());
                    }
                    registry.register("openai", config, provider);
                }
                Err(e) => {
                    tracing::warn!(
                        "Failed to create OpenAI provider: {}",
                        e
                    )
                }
            }
        }
    }

    // Anthropic
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        if !key.is_empty() {
            let default_model = std::env::var("ANTHROPIC_MODEL")
                .unwrap_or_else(|_| {
                    "claude-3-5-sonnet-20241022".to_string()
                });
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
                        first_provider_id =
                            Some("anthropic".to_string());
                    }
                    registry
                        .register("anthropic", config, provider);
                }
                Err(e) => {
                    tracing::warn!(
                        "Failed to create Anthropic provider: {}",
                        e
                    )
                }
            }
        }
    }

    // Resolve default: if the requested default is invalid, use the first registered one
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
             OPENAI_API_KEY, or ANTHROPIC_API_KEY."
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
    let rag = RagPipeline::new(
        embeddings.clone(),
        qdrant.clone(),
        Arc::clone(&providers),
    );
    tracing::info!("RAG pipeline initialized");

    // JWT configuration
    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps-ai".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // Create application state
    let state = AppState {
        pool,
        qdrant,
        embeddings,
        providers,
        rag,
        jwt_config,
    };

    // Build router
    let app = create_router(state);

    // Start server
    let port: u16 = std::env::var("SERVER_PORT")
        .unwrap_or_else(|_| "3005".into())
        .parse()
        .unwrap_or(3005);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Create the application router with all routes.
fn create_router(state: AppState) -> Router {
    // Public routes (health check)
    let public_routes =
        Router::new().route("/health", get(health::health_check));

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
        // Models & Providers
        .route("/models", get(models::list_models))
        .route("/providers", get(providers::list_providers))
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
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Combine all routes
    Router::new()
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
