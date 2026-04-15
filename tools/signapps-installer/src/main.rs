//! SignApps Platform — On-premise installer.
//!
//! Self-contained binary that embeds `docker-compose.prod.yml` and the env
//! template, and drives Docker to initialise, start, update, and back up a
//! SignApps deployment on the user's own server.

mod assets;
mod cli;
mod commands;
mod config;

use clap::Parser;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_target(false)
        .with_level(true)
        .init();

    let args = cli::Cli::parse();
    args.execute().await
}
