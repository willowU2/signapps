pub mod api;
pub mod auth;
pub mod handlers;
pub mod models;
pub mod sync_service;

use handlers::rules::RuleStore;
use handlers::signatures::SignatureStore;
use signapps_common::bootstrap::{env_or, env_required, init_tracing, load_env};
use signapps_common::middleware::{auth_middleware, AuthState};
use signapps_common::{AiIndexerClient, JwtConfig};
use sqlx::{postgres::PgPoolOptions, Pool, Postgres};
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

#[derive(Clone)]
pub struct AppState {
    pub pool: Pool<Postgres>,
    pub jwt_config: JwtConfig,
    pub indexer: AiIndexerClient,
    pub signatures: SignatureStore,
    pub rules: RuleStore,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[tokio::main]
async fn main() {
    // Initialize using bootstrap helpers
    init_tracing("signapps_mail");
    load_env();

    let port: u16 = env_or("SERVER_PORT", "3012").parse().unwrap_or(3012);
    tracing::info!("🚀 Starting signapps-mail on port {}", port);

    // Database
    let database_url = env_or(
        "DATABASE_URL",
        "postgres://signapps:password@localhost:5432/signapps",
    );
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");

    // JWT configuration (custom: audience="signapps" for all services)
    let jwt_secret = env_required("JWT_SECRET");
    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 3600,
        refresh_expiration: 86400 * 7,
    };

    let state = AppState {
        pool: pool.clone(),
        jwt_config,
        indexer: AiIndexerClient::from_env(),
        signatures: SignatureStore::new(),
        rules: RuleStore::new(),
    };

    // Start background sync service
    let sync_pool = pool.clone();
    tokio::spawn(async move {
        sync_service::start_sync_scheduler(sync_pool).await;
    });

    let app = api::router()
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ))
        .layer(
            CorsLayer::new()
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
                    axum::http::header::ORIGIN, axum::http::HeaderName::from_static("x-workspace-id"), axum::http::HeaderName::from_static("x-request-id"),
                ]),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // Start server
    let addr: std::net::SocketAddr = format!("0.0.0.0:{}", port).parse().unwrap();
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    tracing::info!("✅ signapps-mail ready at http://localhost:{}", port);
    axum::serve(listener, app).await.unwrap();
}
