//! signapps-seed binary entry point.

use clap::Parser;
use signapps_seed::{run_seed, SeedArgs};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info,signapps_seed=info")),
        )
        .init();

    let args = SeedArgs::parse();
    run_seed(args).await
}
