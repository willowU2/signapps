//! Health check handler.

use axum::{response::IntoResponse, Json};

/// Return a simple JSON health status.
pub async fn health() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-billing",
        "version": env!("CARGO_PKG_VERSION"),
        "app": {
            "id": "billing",
            "label": "Facturation",
            "description": "Facturation et abonnements",
            "icon": "CreditCard",
            "category": "Business",
            "color": "text-emerald-500",
            "href": "/billing",
            "port": 8096
        }
    }))
}
