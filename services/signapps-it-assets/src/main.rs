use axum::Router;
use signapps_common::config::AppConfig;
use std::net::SocketAddr;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod handlers;
mod models;
mod routes;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "signapps_it_assets=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Configuration overrides loading...");
    dotenvy::dotenv().ok();

    // We override port if needed using std::env before loading config, or just use AppConfig
    let config = AppConfig::load()?;

    let pool = signapps_db::create_pool(&config.database.url).await?;

    let app = Router::new()
        .nest("/api/v1/it-assets", routes::api_routes())
        .with_state(pool)
        .layer(TraceLayer::new_for_http());

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "3015".to_string())
        .parse()?;
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    tracing::info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
