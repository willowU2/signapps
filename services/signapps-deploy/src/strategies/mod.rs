//! Deployment strategies.
//!
//! Phase 1-4: `MaintenanceWindow` — single host, short maintenance page.
//! Phase 5: `BlueGreen` — 2 hosts, zero-downtime via active_stack swap.

pub mod blue_green;
pub mod maintenance_window;

use anyhow::Result;
use async_trait::async_trait;

/// Pluggable deployment strategy. Implementations encapsulate the
/// orchestration logic for one particular deployment model.
#[async_trait]
pub trait DeploymentStrategy: Send + Sync {
    /// Deploy a version to an env.
    async fn deploy(&self, env: &str, version: &str) -> Result<()>;
    /// Rollback the env.
    async fn rollback(&self, env: &str) -> Result<()>;
    /// Human-readable strategy name (for logs, audit).
    fn name(&self) -> &'static str;
}
