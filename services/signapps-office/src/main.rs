use axum::{
    routing::{get, post},
    Router,
};
use signapps_common::bootstrap::{init_tracing, load_env, env_or};
use tower_http::trace::TraceLayer;

mod api;

#[tokio::main]
async fn main() {
    // Initialize using bootstrap helpers
    init_tracing("signapps_office");
    load_env();

    let port: u16 = env_or("SERVER_PORT", "3018").parse().unwrap_or(3018);
    tracing::info!("🚀 Starting signapps-office on port {}", port);

    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/api/v1/convert", post(api::convert::handle_convert))
        .layer(TraceLayer::new_for_http());

    // Start server
    let addr: std::net::SocketAddr = format!("0.0.0.0:{}", port).parse().unwrap();
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    tracing::info!("✅ signapps-office ready at http://localhost:{}", port);
    axum::serve(listener, app).await.unwrap();
}
