//! Command-line interface for signapps-deploy.

use chrono::{DateTime, Utc};
use clap::{Parser, Subcommand};

/// Top-level CLI for the deployment orchestrator.
#[derive(Parser)]
#[command(name = "signapps-deploy", about = "SignApps deployment orchestrator")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

/// Supported CLI subcommands.
#[derive(Subcommand)]
pub enum Command {
    /// Deploy a specific version to an environment.
    Deploy {
        #[arg(long, value_parser = ["prod", "dev"])]
        env: String,
        #[arg(long)]
        version: String,
    },
    /// Roll back the last deployment of an environment.
    Rollback {
        #[arg(long, value_parser = ["prod", "dev"])]
        env: String,
    },
    /// Show deployment status of an environment.
    Status {
        #[arg(long, value_parser = ["prod", "dev"])]
        env: String,
    },
    /// Promote the last successful dev deployment to prod.
    Promote,
    /// Schedule a maintenance window.
    ScheduleMaintenance {
        #[arg(long, value_parser = ["prod", "dev"])]
        env: String,
        /// RFC 3339 timestamp, e.g. 2026-04-20T03:00:00Z
        #[arg(long)]
        at: DateTime<Utc>,
        /// Duration in minutes (1-720)
        #[arg(long)]
        duration_minutes: i32,
        /// Human-readable message shown in the UI (future Phase 3)
        #[arg(long, default_value = "Scheduled maintenance")]
        message: String,
    },
    /// List upcoming maintenance windows.
    ListMaintenance {
        #[arg(long, value_parser = ["prod", "dev"], default_value = "prod")]
        env: String,
    },
}

impl Cli {
    /// Dispatch the parsed subcommand to its orchestrator handler.
    ///
    /// # Errors
    ///
    /// Returns an error propagated from the underlying orchestrator call.
    /// In Phase 1 every subcommand returns an "not yet implemented" error;
    /// Tasks 7-11 will flesh these out.
    pub async fn execute(self) -> anyhow::Result<()> {
        match self.command {
            Command::Deploy { env, version } => crate::orchestrator::deploy(&env, &version).await,
            Command::Rollback { env } => crate::orchestrator::rollback(&env).await,
            Command::Status { env } => crate::orchestrator::status(&env).await,
            Command::Promote => crate::promote::promote_dev_to_prod().await,
            Command::ScheduleMaintenance {
                env,
                at,
                duration_minutes,
                message,
            } => crate::promote::schedule_maintenance(&env, at, duration_minutes, &message).await,
            Command::ListMaintenance { env } => crate::promote::list_maintenance(&env).await,
        }
    }
}
