//! Scheduled maintenance worker binary — long-lived process.

use anyhow::{Context, Result};
use signapps_deploy::scheduler::{run, SchedulerDeps};
use sqlx::PgPool;

#[tokio::main]
async fn main() -> Result<()> {
    signapps_common::bootstrap::init_tracing("signapps-deploy-scheduler");
    signapps_common::bootstrap::load_env();

    let url = std::env::var("DATABASE_URL").context("DATABASE_URL not set")?;
    let pool = PgPool::connect(&url).await?;

    run(SchedulerDeps { pool }).await
}
