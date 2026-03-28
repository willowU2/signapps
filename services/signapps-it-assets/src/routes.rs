use axum::{routing::get, Json, Router};
use signapps_db::DatabasePool;

use crate::handlers::{
    create_hardware, delete_hardware, get_hardware, list_hardware, update_hardware,
};

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "service": "signapps-it-assets" }))
}

pub fn api_routes() -> Router<DatabasePool> {
    Router::new()
        .route("/hardware", get(list_hardware).post(create_hardware))
        .route(
            "/hardware/:id",
            get(get_hardware)
                .put(update_hardware)
                .delete(delete_hardware),
        )
}

pub fn public_routes() -> Router<DatabasePool> {
    Router::new().route("/health", get(health))
}
