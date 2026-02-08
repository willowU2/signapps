//! Traefik dynamic configuration management.

pub mod client;
pub mod config;

pub use client::TraefikClient;
pub use config::*;
