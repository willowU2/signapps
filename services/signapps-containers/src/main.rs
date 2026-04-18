//! Legacy single-service binary entry for signapps-containers.
//!
//! The preferred runtime is `signapps-platform` (single binary).  This
//! binary is preserved for `just start-legacy` and targeted debugging.

use anyhow::Result;
use signapps_common::bootstrap::{init_tracing_with_filter, run_server, ServiceConfig};
use signapps_service::shared_state::SharedState;

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing_with_filter(
        "info,signapps=debug,signapps_containers=debug,bollard=warn,sqlx=warn,tower_http=debug",
    );
    let shared = SharedState::init_once().await?;
    let router = signapps_containers::router(shared).await?;
    let config = ServiceConfig::from_env("signapps-containers", 3002);
    config.log_startup();
    run_server(router, &config).await
}
