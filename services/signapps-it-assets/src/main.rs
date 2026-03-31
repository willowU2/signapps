use axum::Router;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use tower_http::cors::{AllowOrigin, CorsLayer};
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

    // Build extended AppState (DB + live agent WS channels)
    let state = handlers::AppState::new(pool);

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

    let app = Router::new()
        .merge(routes::public_routes().with_state(state.pool.clone()))
        .nest("/api/v1/it-assets", routes::api_routes())
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    // Start server using bootstrap helper
    signapps_common::bootstrap::run_server(app, &config).await
}
