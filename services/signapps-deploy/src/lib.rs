//! SignApps deployment orchestrator — library surface.
//!
//! Exposes modules used by the CLI binary and by integration tests. The HTTP
//! API is dormant in Phase 1; it will be activated in Phase 3 via
//! `DEPLOY_API_ENABLED=true`.

pub mod cli;
pub mod docker;
pub mod maintenance;
pub mod migrate;
pub mod orchestrator;
pub mod persistence;
