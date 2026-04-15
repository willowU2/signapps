//! CLI surface — 6 commands for the on-premise workflow.

use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(
    name = "signapps-installer",
    about = "On-premise installer for SignApps Platform",
    version
)]
pub struct Cli {
    /// Config directory (defaults to `/etc/signapps` on Linux, `%PROGRAMDATA%\signapps` on Windows).
    #[arg(long, global = true)]
    pub config_dir: Option<PathBuf>,

    #[command(subcommand)]
    pub command: Command,
}

#[derive(Subcommand)]
pub enum Command {
    /// Initialise a new SignApps deployment in the config directory.
    Init {
        /// Overwrite an existing config.
        #[arg(long)]
        force: bool,
    },
    /// Start the stack.
    Start,
    /// Stop the stack.
    Stop,
    /// Pull a specific version and recreate the containers.
    Update {
        #[arg(long)]
        version: String,
    },
    /// Show the health of the running stack.
    Status,
    /// Backup the PG database + volumes.
    Backup {
        /// Output directory (defaults to config_dir/backups).
        #[arg(long)]
        output_dir: Option<PathBuf>,
    },
}

impl Cli {
    pub async fn execute(self) -> anyhow::Result<()> {
        match self.command {
            Command::Init { force } => crate::commands::init::run(self.config_dir, force).await,
            Command::Start => crate::commands::start::run(self.config_dir).await,
            Command::Stop => crate::commands::stop::run(self.config_dir).await,
            Command::Update { version } => {
                crate::commands::update::run(self.config_dir, &version).await
            },
            Command::Status => crate::commands::status::run(self.config_dir).await,
            Command::Backup { output_dir } => {
                crate::commands::backup::run(self.config_dir, output_dir).await
            },
        }
    }
}
