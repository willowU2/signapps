use axum::{middleware, Router};
use signapps_cache::CacheService;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{auth_middleware, tenant_context_middleware};
use signapps_common::JwtConfig;
use signapps_sharing::routes::sharing_routes;
use signapps_sharing::{ResourceType, SharingEngine};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

mod handlers;
mod models;
mod routes;

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_it_assets");
    load_env();

    let config = ServiceConfig::from_env("signapps-it-assets", 3022);
    config.log_startup();

    // Database
    let pool = signapps_db::create_pool(&config.database_url).await?;
    tracing::info!("Database connected");

    // JWT config — auto-detects RS256 or HS256 from environment
    let jwt_config = JwtConfig::from_env();

    // Build extended AppState (DB + live agent WS channels)
    let state = handlers::AppState::new(pool.clone(), jwt_config);

    let sharing_engine = SharingEngine::new(pool.inner().clone(), CacheService::default_config());

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().expect("valid origin"),
            "http://127.0.0.1:3000".parse().expect("valid origin"),
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

    // Sharing sub-router: State<SharingEngine> — separate from AppState.
    let sharing_sub = sharing_routes("assets", ResourceType::Asset)
        .with_state(sharing_engine);

    let protected_routes = routes::api_routes(state.clone())
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<handlers::AppState>,
        ));

    let app = Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url(
            "/api-docs/openapi.json",
            handlers::openapi::ItAssetsApiDoc::openapi(),
        ))
        .merge(signapps_common::version::router("signapps-it-assets"))
        .merge(routes::public_routes().with_state(state.pool.clone()))
        .nest("/api/v1/it-assets", protected_routes)
        .merge(sharing_sub)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    // Start server using bootstrap helper
    signapps_common::bootstrap::run_server(app, &config).await
}
