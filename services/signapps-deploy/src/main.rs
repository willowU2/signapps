//! SignApps Deploy — Orchestrator for multi-environment deployments.
//!
//! In Phase 1 this runs as a CLI only. The HTTP API is dormant and will be
//! activated in Phase 3 via `DEPLOY_API_ENABLED=true`.

use clap::Parser;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    signapps_common::bootstrap::init_tracing("signapps-deploy");
    signapps_common::bootstrap::load_env();

    let args = signapps_deploy::cli::Cli::parse();
    args.execute().await
}
