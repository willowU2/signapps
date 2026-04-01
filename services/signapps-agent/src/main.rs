//! SignApps Endpoint Agent
//! Lightweight Rust binary for managed endpoints.
//! Capabilities: inventory, scripts, patches, remote screen, auto-update,
//!               services monitor, backup, bandwidth monitoring.

mod backup;
mod config;
mod heartbeat;
mod inventory;
mod openapi;
mod patches;
mod remote;
mod scripts;
mod services;
mod status;

use axum::{routing::get, Router};
use clap::Parser;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Parser)]
#[command(name = "signapps-agent", about = "SignApps endpoint management agent")]
struct Cli {
    /// Enroll with server
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(clap::Subcommand)]
enum Command {
    /// Enroll this machine with the SignApps server
    Enroll {
        /// Server URL (e.g., https://signapps.local)
        #[arg(long)]
        server: String,
        /// One-time enrollment token
        #[arg(long)]
        token: String,
    },
    /// Run the agent (default)
    Run,
    /// Show agent status
    Status,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("signapps_agent=info")
        .init();

    let cli = Cli::parse();
    let config = Arc::new(RwLock::new(config::AgentConfig::load()?));

    match cli.command.unwrap_or(Command::Run) {
        Command::Enroll { server, token } => {
            config::enroll(&server, &token).await?;
            tracing::info!("Enrollment successful");
        },
        Command::Run => {
            let cfg = config.read().await;
            if cfg.agent_id.is_none() {
                tracing::error!(
                    "Not enrolled. Run: signapps-agent enroll --server URL --token TOKEN"
                );
                std::process::exit(1);
            }
            drop(cfg);
            run_agent(config).await?;
        },
        Command::Status => {
            let cfg = config.read().await;
            println!(
                "Agent ID: {}",
                cfg.agent_id.as_deref().unwrap_or("not enrolled")
            );
            println!("Server: {}", cfg.server_url.as_deref().unwrap_or("not set"));
        },
    }
    Ok(())
}

async fn run_agent(config: Arc<RwLock<config::AgentConfig>>) -> anyhow::Result<()> {
    tracing::info!("SignApps Agent starting...");

    // Spawn minimal status HTTP server (default port 9999)
    let status_port: u16 = std::env::var("AGENT_STATUS_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(9999);
    let status_config = config.clone();
    tokio::spawn(async move {
        let app = Router::new()
            .route("/health", get(status::agent_health))
            .route("/status", get(status::agent_status))
            .merge(openapi::swagger_router())
            .with_state(status_config);
        let addr = format!("0.0.0.0:{}", status_port);
        match tokio::net::TcpListener::bind(&addr).await {
            Ok(listener) => {
                tracing::info!("Agent status interface on port {}", status_port);
                let _ = axum::serve(listener, app).await;
            },
            Err(e) => tracing::warn!("Status interface unavailable: {}", e),
        }
    });

    // Spawn concurrent tasks
    let cfg = config.clone();
    let heartbeat_handle = tokio::spawn(async move { heartbeat::heartbeat_loop(cfg).await });

    let cfg = config.clone();
    let inventory_handle = tokio::spawn(async move { inventory::inventory_loop(cfg).await });

    let cfg = config.clone();
    let scripts_handle = tokio::spawn(async move { scripts::script_poll_loop(cfg).await });

    let cfg = config.clone();
    let patches_handle = tokio::spawn(async move { patches::patch_scan_loop(cfg).await });

    let cfg = config.clone();
    let remote_handle = tokio::spawn(async move { remote::remote_access_server(cfg).await });

    // Feature 24: Service/process monitoring
    let cfg = config.clone();
    let services_handle = tokio::spawn(async move { services::services_monitor_loop(cfg).await });

    // Feature 25: Endpoint backup
    let cfg = config.clone();
    let backup_handle = tokio::spawn(async move { backup::backup_loop(cfg).await });

    tracing::info!("All agent tasks running");

    // Wait for any task to finish (they should run forever)
    tokio::select! {
        r = heartbeat_handle  => tracing::error!("Heartbeat task exited: {:?}", r),
        r = inventory_handle  => tracing::error!("Inventory task exited: {:?}", r),
        r = scripts_handle    => tracing::error!("Scripts task exited: {:?}", r),
        r = patches_handle    => tracing::error!("Patches task exited: {:?}", r),
        r = remote_handle     => tracing::error!("Remote task exited: {:?}", r),
        r = services_handle   => tracing::error!("Services task exited: {:?}", r),
        r = backup_handle     => tracing::error!("Backup task exited: {:?}", r),
    }

    Ok(())
}
