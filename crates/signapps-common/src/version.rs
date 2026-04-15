//! Version info endpoint for all SignApps services.
//!
//! Exposes `GET /version` returning build-time and git metadata.
//! Each service gets its own version router via [`router()`].

use axum::{response::Json, routing::get, Router};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Version metadata exposed on `/version` by every service.
///
/// Populated at compile time from `vergen` environment variables plus
/// the `SIGNAPPS_ENV` runtime variable (`prod` | `dev`).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VersionInfo {
    /// Service name (e.g. `signapps-identity`).
    pub service: String,
    /// Crate version from `CARGO_PKG_VERSION`.
    pub version: String,
    /// Git commit SHA at build time.
    pub git_sha: String,
    /// Build timestamp (ISO 8601).
    pub build_time: String,
    /// Runtime environment (`prod`, `dev`, or `unknown`).
    pub env: String,
}

impl VersionInfo {
    /// Build a [`VersionInfo`] using the given service name and compile-time
    /// environment variables.
    pub fn from_env(service_name: &'static str) -> Self {
        Self {
            service: service_name.to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            git_sha: env!("VERGEN_GIT_SHA").to_string(),
            build_time: env!("VERGEN_BUILD_TIMESTAMP").to_string(),
            env: std::env::var("SIGNAPPS_ENV").unwrap_or_else(|_| "unknown".to_string()),
        }
    }
}

/// Returns a pre-built router with `GET /version` mounted.
pub fn router(service_name: &'static str) -> Router {
    let info = VersionInfo::from_env(service_name);
    Router::new().route(
        "/version",
        get(move || {
            let info = info.clone();
            async move { Json(info) }
        }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_info_populates_all_fields() {
        let info = VersionInfo::from_env("test-svc");
        assert_eq!(info.service, "test-svc");
        assert!(!info.version.is_empty());
        assert!(!info.git_sha.is_empty());
        assert!(!info.build_time.is_empty());
    }
}
