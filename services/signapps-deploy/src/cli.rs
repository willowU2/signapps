//! Command-line interface for signapps-deploy.

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
        }
    }
}
