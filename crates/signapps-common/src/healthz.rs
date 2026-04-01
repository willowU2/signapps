//! Standardised health check handler — IDEA-111
//!
//! Provides a consistent `GET /health` response across all SignApps services.
//!
//! Response format:
//! ```json
//! {
//!   "status": "ok",
//!   "service": "signapps-identity",
//!   "version": "0.1.0",
//!   "uptime_seconds": 123
//! }
//! ```
//!
//! Usage in a service main.rs:
//! ```rust,ignore
//! use signapps_common::healthz::health_handler;
//! let public = Router::new().route("/health", get(health_handler("signapps-identity")));
//! ```

use axum::{response::IntoResponse, Json};
use serde::Serialize;
use std::sync::OnceLock;
use std::time::Instant;

static START_TIME: OnceLock<Instant> = OnceLock::new();

/// Call once at process startup to record the process start time.
pub fn init_start_time() {
    START_TIME.get_or_init(Instant::now);
}

/// Returns uptime in seconds since `init_start_time` was called (or 0).
pub fn uptime_seconds() -> u64 {
    START_TIME.get().map(|t| t.elapsed().as_secs()).unwrap_or(0)
}

/// Response payload returned by the `/health` endpoint.
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    /// Fixed string `"ok"` when the service is healthy.
    pub status: &'static str,
    /// Name of the service (e.g. `"signapps-identity"`).
    pub service: String,
    /// Semver version string from `CARGO_PKG_VERSION`.
    pub version: &'static str,
    /// Seconds elapsed since `init_start_time` was called at process startup.
    pub uptime_seconds: u64,
}

/// Returns a standard health JSON response.
///
/// Suitable for use as an Axum handler via a closure:
/// ```rust,ignore
/// let svc = "signapps-identity";
/// router.route("/health", get(move || health(svc)));
/// ```
pub async fn health(service: &'static str) -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok",
        service: service.to_string(),
        version: env!("CARGO_PKG_VERSION"),
        uptime_seconds: uptime_seconds(),
    })
}
