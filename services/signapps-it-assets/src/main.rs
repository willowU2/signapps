//! Legacy single-service binary entry for signapps-it-assets.
//!
//! The preferred runtime is `signapps-platform` (single binary).  This
//! binary is preserved for `just start-legacy` and targeted debugging.

use anyhow::Result;
use signapps_common::bootstrap::{init_tracing, run_server, ServiceConfig};
use signapps_service::shared_state::SharedState;

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing("signapps_it_assets");
    let shared = SharedState::init_once().await?;
    signapps_db::run_migrations(&shared.pool)
        .await
        .unwrap_or_else(|e| tracing::warn!(?e, "migrations warning (non-fatal)"));
    let router = signapps_it_assets::router(shared).await?;
    let config = ServiceConfig::from_env("signapps-it-assets", 3022);
    config.log_startup();
    run_server(router, &config).await
}
