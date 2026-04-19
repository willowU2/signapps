//! SignApps Platform — single-binary runtime.
//!
//! Boots shared resources once, runs Postgres migrations once, then
//! spawns every service router as a supervised tokio task.

use std::sync::Arc;

use anyhow::Result;
use signapps_common::bootstrap::init_tracing;
use signapps_db::run_migrations;
use signapps_org::rbac_client::OrgClient;
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

    // Build the canonical RBAC resolver from the shared pool and inject
    // it into every service's view of SharedState. 60s cache TTL — short
    // enough to absorb `org.policy.updated` events.
    let resolver = Arc::new(OrgClient::new(
        Arc::new(shared.pool.inner().clone()),
        60,
    ));

    // Spawn the cache invalidation listener so `org.grant.*`,
    // `org.policy.updated` and `org.assignment.changed` events wipe the
    // affected decisions.  Uses the runtime event_bus so catch-up +
    // LISTEN survive service restarts (bus consumers track their
    // cursor in `platform.event_consumers`).
    signapps_org::events::spawn_invalidation_listener(
        shared.event_bus.clone(),
        resolver.clone(),
    );

    let shared = shared.with_resolver(resolver);
    tracing::info!("rbac resolver attached to shared state");

    if std::env::var("SIGNAPPS_PLATFORM_EXIT_AFTER_BOOT").is_ok() {
        tracing::info!("exit-after-boot flag set; returning");
        return Ok(());
    }

    let specs = services::declare(shared);
    tracing::info!(count = specs.len(), "spawning services");

    Supervisor::new(specs).run_forever().await
}
