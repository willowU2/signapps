use axum::Json;
use serde_json::json;

pub async fn health_handler() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "service": "signapps-docs",
        "version": "0.1.0",
        "types": ["text", "sheet", "slide", "board"]
    }))
}
