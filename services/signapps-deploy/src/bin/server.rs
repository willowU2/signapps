//! SignApps Deploy HTTP API server.
//!
//! Dormant by default: exits cleanly with a warning if `DEPLOY_API_ENABLED`
//! is not `"true"`. Otherwise starts an Axum server on `DEPLOY_PORT`
//! (default `3700`).
//!
//! # Port choice
//!
//! The default port `3700` sits immediately after the Windows Hyper-V reserved
//! range (typically `2953-3653` on Windows Desktop hosts with Docker/WSL
//! installed). Running the server natively on Windows with a port inside that
//! range fails with `WSAEACCES (os error 10013)`. Docker-bridged deployments
//! are unaffected because they bind inside the container namespace.

use anyhow::{Context, Result};
use signapps_cache::CacheService;
use signapps_common::JwtConfig;
use signapps_deploy::api::{routes::build_router, state::AppState};
use signapps_feature_flags::{cache::FeatureFlagCache, repository::PgFeatureFlagRepository};
use sqlx::PgPool;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<()> {
    signapps_common::bootstrap::init_tracing("signapps-deploy-server");
    signapps_common::bootstrap::load_env();

    if std::env::var("DEPLOY_API_ENABLED").unwrap_or_else(|_| "false".into()) != "true" {
        tracing::warn!(
            "DEPLOY_API_ENABLED is not 'true'; HTTP API is dormant. \
             Set DEPLOY_API_ENABLED=true to enable it."
        );
        return Ok(());
    }

    let db_url = std::env::var("DATABASE_URL").context("DATABASE_URL not set")?;
    let pool = PgPool::connect(&db_url).await?;

    let cache = Arc::new(CacheService::default_config());
    let jwt = JwtConfig::from_env();

    let feature_flags =
        PgFeatureFlagRepository::new(pool.clone(), FeatureFlagCache::new(cache.clone()));

    let state = AppState {
        pool,
        cache,
        jwt,
        feature_flags,
    };

    let port = std::env::var("DEPLOY_PORT")
        .unwrap_or_else(|_| "3700".into())
        .parse::<u16>()
        .context("invalid DEPLOY_PORT")?;

    let app = build_router(state);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await?;
    tracing::info!(port, "signapps-deploy HTTP API listening");
    axum::serve(listener, app).await?;
    Ok(())
}
