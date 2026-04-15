//! The original strategy: enable maintenance flag → compose up → disable flag.
//!
//! Delegates to the existing `orchestrator::deploy` / `rollback` functions
//! to preserve Phase 1-4 behaviour without duplicating code.

use super::DeploymentStrategy;
use crate::orchestrator;
use anyhow::Result;
use async_trait::async_trait;

/// Single-host deploy strategy with a short maintenance window.
pub struct MaintenanceWindowStrategy;

#[async_trait]
impl DeploymentStrategy for MaintenanceWindowStrategy {
    async fn deploy(&self, env: &str, version: &str) -> Result<()> {
        orchestrator::deploy(env, version).await
    }

    async fn rollback(&self, env: &str) -> Result<()> {
        orchestrator::rollback(env).await
    }

    fn name(&self) -> &'static str {
        "maintenance_window"
    }
}
