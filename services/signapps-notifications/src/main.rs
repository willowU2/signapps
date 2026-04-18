//! Legacy single-service binary entry for signapps-notifications.
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
    init_tracing("signapps_notifications");
    let shared = SharedState::init_once().await?;
    let router = signapps_notifications::router(shared).await?;
    let config = ServiceConfig::from_env("signapps-notifications", 8095);
    config.log_startup();
    run_server(router, &config).await
}
