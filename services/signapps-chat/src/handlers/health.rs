//! Health-check handler.

/// Return service health status.
pub async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-chat",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "chat",
            "label": "Chat",
            "description": "Messagerie instantanée en équipe",
            "icon": "MessageSquare",
            "category": "Communication",
            "color": "text-primary",
            "href": "/chat",
            "port": 3020
        }
    }))
}
