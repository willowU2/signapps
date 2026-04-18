//! SignApps deployment orchestrator — library surface.
//!
//! Exposes modules used by the CLI binary and by integration tests. The HTTP
//! API is dormant in Phase 1; it will be activated in Phase 3 via
//! `DEPLOY_API_ENABLED=true`.

pub mod api;
pub mod cli;
pub mod docker;
pub mod maintenance;
pub mod migrate;
pub mod orchestrator;
pub mod persistence;
pub mod promote;
pub mod scheduler;
pub mod strategies;

use axum::{routing::get, Router};
use signapps_cache::CacheService;
use signapps_feature_flags::{cache::FeatureFlagCache, repository::PgFeatureFlagRepository};
use signapps_service::shared_state::SharedState;
use std::sync::Arc;

/// Build the deploy router using the shared runtime state. The protected
/// `/api/v1/deploy/*` API is gated behind the `DEPLOY_API_ENABLED` env
/// flag (default-off); when disabled, only the public `/health` and
/// `/version` routes are mounted so the supervisor can probe the service.
///
/// # Errors
///
/// Returns an error if shared-state cloning fails (none currently, but reserved).
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let public = Router::new()
        .route("/health", get(health_check))
        .merge(signapps_common::version::router("signapps-deploy"));

    let api_enabled = std::env::var("DEPLOY_API_ENABLED")
        .ok()
        .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
        .unwrap_or(false);

    if !api_enabled {
        tracing::info!("DEPLOY_API_ENABLED not set; deploy HTTP API is dormant");
        return Ok(public);
    }

    let pool = shared.pool.inner().clone();
    let cache = Arc::new(CacheService::default_config());
    let feature_flags =
        PgFeatureFlagRepository::new(pool.clone(), FeatureFlagCache::new(cache.clone()));

    let state = api::state::AppState {
        pool,
        cache,
        jwt: (*shared.jwt).clone(),
        feature_flags,
    };

    Ok(public.merge(api::routes::build_router(state)))
}

async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-deploy",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "deploy",
            "label": "Déploiements",
            "description": "Orchestrateur de déploiements multi-environnements",
            "icon": "Rocket",
            "category": "Administration",
            "color": "text-orange-500",
            "href": "/admin/deploy",
            "port": 3700
        }
    }))
}
