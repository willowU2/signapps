//! Workforce Service Handlers
//!
//! Request handlers organized by domain:
//! - org: Organizational tree management
//! - employees: Employee CRUD and functions
//! - coverage: Coverage templates and rules
//! - validation: Gap analysis and leave simulation

pub mod coverage;
pub mod employees;
pub mod learning;
pub mod org;
pub mod validation;

use axum::Json;
use serde::Serialize;

/// Health check response
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub service: &'static str,
    pub version: &'static str,
}

/// Health check endpoint
pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "signapps-workforce",
        version: env!("CARGO_PKG_VERSION"),
    })
}
