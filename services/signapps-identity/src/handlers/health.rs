//! Health check handler.

use axum::Json;

/// Health check endpoint.
#[tracing::instrument(skip_all)]
pub async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "signapps-identity",
        "version": env!("CARGO_PKG_VERSION"),
        "app": {
            "id": "users",
            "label": "Utilisateurs",
            "description": "Gestion des comptes utilisateurs",
            "icon": "Users",
            "category": "Administration",
            "color": "text-orange-500",
            "href": "/admin/users",
            "port": 3001
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
        // Placeholder: ensures the module compiles.
        let _ = module_path!();
    }
}
