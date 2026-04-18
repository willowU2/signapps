//! Legacy single-service binary entry for signapps-integrations.
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
    init_tracing("signapps_integrations");
    let shared = SharedState::init_once().await?;
    let router = signapps_integrations::router(shared).await?;
    let config = ServiceConfig::from_env("signapps-integrations", 3030);
    config.log_startup();
    run_server(router, &config).await
}
