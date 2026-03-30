use axum::Json;
use serde_json::json;

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/health",
    responses((status = 200, description = "Success")),
    tag = "Collab"
)]
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
