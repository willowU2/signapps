//! Health check HTTP endpoint for monitoring.

use axum::{routing::get, Json, Router};
use sqlx::PgPool;

/// Health response.
async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "service": "signapps-dc",
        "status": "healthy",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

/// Run the health check HTTP server.
#[allow(dead_code)]
pub async fn run_health_server(_pool: PgPool, port: u16) -> anyhow::Result<()> {
    let app = Router::new().route("/health", get(health));
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    tracing::info!(port = port, "DC health server started");
    axum::serve(listener, app).await?;
    Ok(())
}
