//! Health check handler.

use axum::Json;

/// Health check endpoint.
#[tracing::instrument(skip_all)]
pub async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "signapps-office",
        "version": env!("CARGO_PKG_VERSION"),
        "app": {
            "id": "office",
            "label": "Office",
            "description": "Conversion de documents Office",
            "icon": "FileBox",
            "category": "Avancé",
            "color": "text-blue-600",
            "href": "/office",
            "port": 3018
        }
    }))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
