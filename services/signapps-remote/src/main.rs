mod handlers;
mod models;

use axum::{routing::get, Router};
use signapps_common::auth::JwtConfig;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{
    logging_middleware, optional_auth_middleware, request_id_middleware,
};
use signapps_db::DatabasePool;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

#[derive(Clone)]
/// Application state for  service.
pub struct AppState {
    pub db: DatabasePool,
    pub jwt_config: JwtConfig,
}

impl signapps_common::middleware::AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

pub async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-remote",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds()
    }))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_remote");
    load_env();

    let config = ServiceConfig::from_env("signapps-remote", 3017);
    config.log_startup();

    // JWT configuration (custom: audience="signapps" for all services)
    let jwt_config = JwtConfig {
        secret: config.jwt_secret.clone(),
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // Database
    let db_pool = signapps_db::create_pool(&config.database_url).await?;
    let app_state = AppState {
        db: db_pool,
        jwt_config,
    };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/remote/health", get(health_check))
        .route(
            "/api/v1/remote/connections",
            get(handlers::list_connections).post(handlers::create_connection),
        )
        .route(
            "/api/v1/remote/connections/:id",
            get(handlers::get_connection)
                .put(handlers::update_connection)
                .delete(handlers::delete_connection),
        )
        .route(
            "/api/v1/remote/ws/:id",
            get(handlers::connection_gateway_ws),
        )
        .layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            optional_auth_middleware::<AppState>,
        ))
        .layer(
            CorsLayer::new()
                .allow_origin(tower_http::cors::Any)
                .allow_methods([
                    axum::http::Method::GET, axum::http::Method::POST, axum::http::Method::PUT,
                    axum::http::Method::DELETE, axum::http::Method::PATCH, axum::http::Method::OPTIONS,
                ])
                .allow_headers([
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::AUTHORIZATION,
                    axum::http::HeaderName::from_static("x-request-id"),
                    axum::http::HeaderName::from_static("x-workspace-id"),
                ])
        )
        .layer(TraceLayer::new_for_http())
        .layer(axum::middleware::from_fn(logging_middleware))
        .layer(axum::middleware::from_fn(request_id_middleware))
        .with_state(app_state);

    // Start server using bootstrap helper
    signapps_common::bootstrap::run_server(app, &config).await
}
