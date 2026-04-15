//! Embedded assets — baked into the binary at compile time.
//!
//! The installer writes these out at `init` time into the config directory
//! so the user has real files on disk to inspect and customise.

/// `docker-compose.prod.yml` — the SignApps production stack definition.
pub const DOCKER_COMPOSE_YAML: &str = include_str!("../assets/docker-compose.prod.yml");

/// `.env.example` — template env file the user fills in.
pub const ENV_EXAMPLE: &str = include_str!("../assets/env.example");

/// Installer version (from vergen).
pub const INSTALLER_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const GIT_SHA: &str = env!("VERGEN_GIT_SHA");
pub const BUILD_TIME: &str = env!("VERGEN_BUILD_TIMESTAMP");
