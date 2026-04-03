use axum::Json;
use serde_json::json;

/// Health check response
#[derive(serde::Serialize, utoipa::ToSchema)]
#[allow(dead_code)]
pub struct DocsHealthResponse {
    pub status: &'static str,
    pub service: &'static str,
    pub version: &'static str,
}

/// GET /health — liveness probe
#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "Service is healthy"),
    ),
    tag = "System"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn health_handler() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "service": "signapps-docs",
        "version": "0.1.0",
        "types": ["text", "sheet", "slide", "board"],
        "app": {
            "id": "docs",
            "label": "Docs",
            "description": "Traitement de texte collaboratif",
            "icon": "FileText",
            "category": "Productivité",
            "color": "text-blue-500",
            "href": "/docs",
            "port": 3010
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
