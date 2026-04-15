//! Maintenance mode middleware (DB-backed since P3c.3).
//!
//! Reads the shared `maintenance_flags` row (migration 309) via
//! [`signapps_common::maintenance_flag`]. When enabled, returns the static
//! maintenance HTML page with HTTP 503. Otherwise forwards the request to the
//! next layer.
//!
//! Failing closed: if the DB read errors, we treat maintenance as disabled to
//! avoid DoS-by-DB. Monitoring picks up DB errors via tracing.

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{Html, IntoResponse, Response},
};
use signapps_common::maintenance_flag;
use sqlx::PgPool;

const MAINTENANCE_HTML: &str = include_str!("../../static/maintenance.html");

/// Paths that must remain reachable even while maintenance mode is active.
///
/// These exist so the frontend can poll liveness and render the static
/// maintenance page while the main application is unavailable:
/// - `/health`, `/version`: operator / probe endpoints
/// - `/maintenance`: the static maintenance landing page
/// - `/_next/`: Next.js static assets used by the maintenance page
/// - `/api/v1/health`: frontend poll endpoint (kept for compatibility)
const MAINTENANCE_ALLOWLIST: &[&str] = &[
    "/health",
    "/version",
    "/maintenance",
    "/_next/",
    "/api/v1/health",
];

fn is_allowlisted(path: &str) -> bool {
    MAINTENANCE_ALLOWLIST
        .iter()
        .any(|prefix| path == *prefix || path.starts_with(prefix))
}

/// State passed to [`maintenance_middleware`] via axum's extractors.
#[derive(Clone)]
pub struct MaintenanceState {
    /// Shared PG pool used to read the `maintenance_flags` row.
    pub pool: PgPool,
    /// Fallback env when [`hostname_router::BackendCluster`] is not injected.
    pub env: String,
}

/// Axum middleware that intercepts traffic when maintenance mode is active.
pub async fn maintenance_middleware(
    State(state): State<MaintenanceState>,
    req: Request,
    next: Next,
) -> Response {
    if is_allowlisted(req.uri().path()) {
        return next.run(req).await;
    }

    // Prefer the env chosen by hostname_router if present; fall back to state.env.
    let env = req
        .extensions()
        .get::<crate::app_middleware::hostname_router::BackendCluster>()
        .map(|c| c.env_name().to_string())
        .unwrap_or_else(|| state.env.clone());

    let is_on = maintenance_flag::is_enabled(&state.pool, &env)
        .await
        .unwrap_or(false);
    if is_on {
        return (StatusCode::SERVICE_UNAVAILABLE, Html(MAINTENANCE_HTML)).into_response();
    }
    next.run(req).await
}

#[cfg(test)]
mod tests {
    // Tests previously used CacheService; the module now hits PG. See the
    // signapps-deploy integration tests for DB-backed coverage. Inline unit
    // tests would need a test DB fixture; omitted here to keep CI
    // DB-independent for the proxy crate.
}
