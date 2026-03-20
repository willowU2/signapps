//! Windows Service Support for SignApps Platform
//!
//! This crate provides utilities for running SignApps services as Windows services.
//!
//! ## Features
//!
//! - Windows Service wrapper with graceful shutdown
//! - Event Log integration for Windows
//! - Cross-platform shutdown signal handling
//!
//! ## Usage
//!
//! ```rust,ignore
//! use signapps_service::{ShutdownSignal, run_with_shutdown};
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let shutdown = ShutdownSignal::new();
//!
//!     // Pass shutdown.clone() to your server
//!     run_with_shutdown(my_server_future, shutdown).await
//! }
//! ```

mod shutdown;

#[cfg(windows)]
mod service;

#[cfg(windows)]
mod eventlog;

pub use shutdown::ShutdownSignal;

#[cfg(windows)]
pub use service::{run_as_service, ServiceDefinition};

#[cfg(windows)]
pub use eventlog::EventLogger;

/// Re-export for convenience
pub use tokio::signal;
