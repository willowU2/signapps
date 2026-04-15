//! HTTP API for the deployment orchestrator.
//!
//! Dormant by default. Activated by setting `DEPLOY_API_ENABLED=true`.
//! All routes require the `superadmin` role (wired in Task P3a.7).

pub mod auth;
pub mod handlers;
pub mod openapi;
pub mod routes;
pub mod state;
