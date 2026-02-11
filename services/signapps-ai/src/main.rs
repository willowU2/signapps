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
use tower::ServiceBuilder;
use tower_http::cors::{Any, CorsLayer};

mod embeddings;
mod handlers;
mod llm;
mod qdrant;
mod rag;

use embeddings::EmbeddingsClient;
use handlers::{chat, health, index, models, providers, search};
use llm::LlmClient;
use qdrant::QdrantService;
use rag::RagPipeline;

/// Application state shared across handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub qdrant: QdrantService,
    pub embeddings: EmbeddingsClient,
    pub llm: LlmClient,
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

    tracing::info!("Starting SignApps AI Service v{}", env!("CARGO_PKG_VERSION"));

    // Load configuration
    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://localhost/signapps".into());
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".into());
    let qdrant_url = std::env::var("QDRANT_URL").unwrap_or_else(|_| "http://localhost:6333".into());
    let embeddings_url =
        std::env::var("EMBEDDINGS_URL").unwrap_or_else(|_| "http://localhost:8080".into());
    let llm_url = std::env::var("VLLM_URL").unwrap_or_else(|_| "http://localhost:8000".into());

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

    let llm = LlmClient::new(&llm_url);
    tracing::info!("LLM client initialized");

    // Initialize RAG pipeline
    let rag = RagPipeline::new(embeddings.clone(), qdrant.clone(), llm.clone());
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
        llm,
        rag,
        jwt_config,
    };

    // Build router
    let app = create_router(state);

    // Start server
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".into())
        .parse()
        .unwrap_or(3000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

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
