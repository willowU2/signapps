pub mod api;
pub mod auth;
pub mod models;
pub mod sync_service;

use signapps_common::middleware::auth_middleware;
use sqlx::{postgres::PgPoolOptions, Pool, Postgres};
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Clone)]
pub struct AppState {
    pub pool: Pool<Postgres>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "signapps_mail=info,tower_http=info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");

    let state = AppState { pool: pool.clone() };

    // Start background sync service
    let sync_pool = pool.clone();
    tokio::spawn(async move {
        sync_service::start_sync_scheduler(sync_pool).await;
    });

    // Get JWT secret
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".into());

    let app = api::router()
        .layer(axum::middleware::from_fn_with_state(
            jwt_secret,
            auth_middleware,
        ))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let port: u16 = std::env::var("SERVER_PORT")
        .unwrap_or_else(|_| "3012".into())
        .parse()
        .unwrap_or(3012);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Mail service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
