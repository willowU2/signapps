//! Workforce Service Handlers
//!
//! Request handlers organized by domain:
//! - org: Organizational tree management
//! - employees: Employee CRUD and functions
//! - coverage: Coverage templates and rules
//! - validation: Gap analysis and leave simulation

pub mod ad;
pub mod attendance;
pub mod audit;
pub mod boards;
pub mod coverage;
pub mod delegations;
pub mod employees;
pub mod groups;
pub mod learning;
pub mod openapi;
pub mod org;
pub mod policies;
pub mod validation;

use axum::Json;

/// Health check endpoint
#[tracing::instrument(skip_all)]
pub async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-workforce",
        "version": env!("CARGO_PKG_VERSION"),
        "app": {
            "id": "workforce",
            "label": "Workforce",
            "description": "RH et gestion des équipes",
            "icon": "Briefcase",
            "category": "Business",
            "color": "text-rose-500",
            "href": "/workforce",
            "port": 3024
        }
    }))
}
