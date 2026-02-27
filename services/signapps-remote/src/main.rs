mod handlers;
mod models;

use axum::{
    routing::{get, post},
    Router,
};
use signapps_common::auth::JwtConfig;
use signapps_common::middleware::{
    auth_middleware, logging_middleware, optional_auth_middleware, request_id_middleware,
};
use signapps_db::{create_pool, DatabasePool};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

#[derive(Clone)]
pub struct AppState {
    pub db: DatabasePool,
    pub jwt_config: JwtConfig,
}

impl signapps_common::middleware::AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

pub async fn health_check() -> &'static str {
    "OK"
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    tracing::info!("Starting SignApps Remote Connection Server");

    dotenvy::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@127.0.0.1:5432/signapps".to_string());
    let port: u16 = std::env::var("SERVER_PORT")
        .unwrap_or_else(|_| "3017".to_string())
        .parse()
        .unwrap_or(3017);

    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "dev_secret_change_in_production_32chars".to_string());

    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    let db_pool = create_pool(&database_url).await?;
    let app_state = AppState {
        db: db_pool,
        jwt_config,
    };

    let app = Router::new()
        .route("/api/v1/remote/health", get(health_check))
        .route(
            "/api/v1/remote/connections",
            get(handlers::list_connections).post(handlers::create_connection),
        )
        .route(
            "/api/v1/remote/ws/:id",
            get(handlers::connection_gateway_ws),
        )
        .layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            optional_auth_middleware::<AppState>,
        ))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .layer(axum::middleware::from_fn(logging_middleware))
        .layer(axum::middleware::from_fn(request_id_middleware))
        .with_state(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
