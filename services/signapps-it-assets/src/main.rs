use axum::Router;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

mod handlers;
mod models;
mod routes;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_it_assets");
    load_env();

    let config = ServiceConfig::from_env("signapps-it-assets", 3015);
    config.log_startup();

    // Database
    let pool = signapps_db::create_pool(&config.database_url).await?;
    tracing::info!("Database connected");

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .merge(routes::public_routes().with_state(pool.clone()))
        .nest("/api/v1/it-assets", routes::api_routes())
        .with_state(pool)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    // Start server using bootstrap helper
    signapps_common::bootstrap::run_server(app, &config).await
}
