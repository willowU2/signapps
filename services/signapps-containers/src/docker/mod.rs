//! Docker client abstraction using bollard.
//!
//! Provides high-level operations for container management.

pub mod client;
pub mod types;

pub use client::DockerClient;
pub use types::*;
