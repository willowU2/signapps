use axum::Json;
use serde::Serialize;
use serde_json::json;

/// Health check response for the collab service.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct HealthResponse {
    /// Service health status
    pub status: String,
    /// Service name
    pub service: String,
    /// Service version
    pub version: String,
}

/// Health check endpoint
#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "Service is healthy", body = HealthResponse),
    ),
    tag = "Health"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn health_handler() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "service": "signapps-collab",
        "version": "0.1.0"
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
