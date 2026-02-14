//! Tunnel management for outbound web VPN connections.
//!
//! This module implements secure tunnels that allow
//! accessing home services from the internet without opening ports.

pub mod client;
pub mod proxy;
pub mod types;

pub use client::{TunnelClient, TunnelClientConfig};
pub use types::*;
