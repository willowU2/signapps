use axum::Json;
use serde_json::json;

#[tracing::instrument(skip_all)]
pub async fn health_handler() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "service": "signapps-docs",
        "version": "0.1.0",
        "types": ["text", "sheet", "slide", "board"]
    }))
}
