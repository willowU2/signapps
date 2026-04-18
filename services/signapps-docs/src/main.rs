//! Legacy single-service binary entry for signapps-docs.
//!
//! The preferred runtime is `signapps-platform` (single binary).  This
//! binary is preserved for `just start-legacy` and targeted debugging.

use anyhow::Result;
use std::net::SocketAddr;

use signapps_common::bootstrap::{init_tracing, ServiceConfig};
use signapps_service::shared_state::SharedState;

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing("signapps_docs");
    let shared = SharedState::init_once().await?;
    let router = signapps_docs::router(shared).await?;
    let config = ServiceConfig::from_env("signapps-docs", 3010);
    config.log_startup();

    // The docs service uses ConnectInfo<SocketAddr> for its WebSocket
    // upgrade handlers, so we can't use the shared `run_server`. We
    // bind manually here with the same graceful-shutdown behavior.
    let addr: std::net::SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .expect("server address is valid");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(
        "signapps-docs listening at http://localhost:{}",
        config.port
    );
    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(signapps_common::graceful_shutdown())
    .await?;
    Ok(())
}
