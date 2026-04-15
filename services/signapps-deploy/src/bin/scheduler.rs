//! Scheduled maintenance worker binary — long-lived process.

use anyhow::{Context, Result};
use signapps_cache::CacheService;
use signapps_deploy::scheduler::{run, SchedulerDeps};
use sqlx::PgPool;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<()> {
    signapps_common::bootstrap::init_tracing("signapps-deploy-scheduler");
    signapps_common::bootstrap::load_env();

    let url = std::env::var("DATABASE_URL").context("DATABASE_URL not set")?;
    let pool = PgPool::connect(&url).await?;
    let cache = Arc::new(CacheService::default_config());

    run(SchedulerDeps { pool, cache }).await
}
