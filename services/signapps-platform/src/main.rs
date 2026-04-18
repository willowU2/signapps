//! SignApps Platform — single-binary runtime.
//!
//! Boots shared resources once, runs Postgres migrations once, then
//! spawns every service router as a supervised tokio task.

use anyhow::Result;
use signapps_common::bootstrap::init_tracing;
use signapps_db::run_migrations;
use signapps_platform::services;
use signapps_service::{shared_state::SharedState, supervisor::Supervisor};

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing("signapps_platform");
    tracing::info!("=== SignApps Platform — single-binary ===");

    let shared = SharedState::init_once().await?;
    tracing::info!("shared state initialized");

    run_migrations(&shared.pool)
        .await
        .unwrap_or_else(|e| tracing::warn!(?e, "migrations warning (non-fatal)"));
    tracing::info!("migrations complete");

    if std::env::var("SIGNAPPS_PLATFORM_EXIT_AFTER_BOOT").is_ok() {
        tracing::info!("exit-after-boot flag set; returning");
        return Ok(());
    }

    let specs = services::declare(shared);
    tracing::info!(count = specs.len(), "spawning services");

    Supervisor::new(specs).run_forever().await
}
